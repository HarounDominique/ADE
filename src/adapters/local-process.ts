import { execFile, type ChildProcess } from "node:child_process";
import crossSpawn from "cross-spawn";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import type {
  ProcessDefinition,
  ProcessEvidence,
  ProcessHandle,
  ProcessPort,
} from "../ports/process.js";

export class LocalProcess implements ProcessPort {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly output = new Map<string, { stdout: string; stderr: string }>();

  async start(definition: ProcessDefinition): Promise<ProcessHandle> {
    const child = crossSpawn(definition.command, [...(definition.args ?? [])], {
      cwd: definition.cwd,
      env: runtimeEnvironment(definition.env),
      stdio: "pipe",
      // cross-spawn preserves argv while safely supporting Windows .cmd shims.
      // Keep Windows children from flashing a second terminal window.
      windowsHide: process.platform === "win32",
      // A detached Windows child gets its own console host even when its
      // stdio is piped. Keep it attached to the sidecar so the terminal dock
      // owns both its lifecycle and output.
      detached: process.platform !== "win32",
    });
    const output = { stdout: "", stderr: "" };
    const id = definition.id;
    child.stdout?.on("data", (chunk: Buffer) => { const text = chunk.toString(); output.stdout += text; definition.onOutput?.({ stream: "stdout", text }); });
    child.stderr?.on("data", (chunk: Buffer) => { const text = chunk.toString(); output.stderr += text; definition.onOutput?.({ stream: "stderr", text }); });
    // Attach before waiting for spawn: a command such as `mvn` can fail and
    // close in the same turn as spawn, and missing that event leaves a stale
    // RUNNING session forever.
    child.once("close", (exitCode, signal) => {
      definition.onExit?.({
        id,
        state: exitCode === 0 && !signal ? "STOPPED" : "FAILED",
        exitCode,
        signal,
        ...output,
      });
      this.processes.delete(id);
    });
    this.processes.set(id, child);
    this.output.set(id, output);
    try {
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", () => resolve());
        child.once("error", reject);
      });
    } catch (error) {
      this.processes.delete(id);
      this.output.delete(id);
      throw error;
    }
    return { id, pid: child.pid ?? -1, state: "RUNNING" };
  }

  async stop(handle: ProcessHandle, timeoutMs = 2_000): Promise<ProcessEvidence> {
    const child = this.processes.get(handle.id);
    const output = this.output.get(handle.id) ?? { stdout: "", stderr: "" };
    if (!child) return { id: handle.id, state: "STOPPED", exitCode: null, signal: null, ...output };
    const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      const timer = setTimeout(() => {
        void killGroup(child, "SIGKILL");
      }, timeoutMs);
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        setTimeout(() => resolve({ exitCode, signal }), 10);
      });
      void killGroup(child, "SIGTERM");
    });
    this.output.delete(handle.id);
    return { id: handle.id, state: "STOPPED", ...result, ...output };
  }
}

/** A packaged desktop app is opened by the operating system's own shell --
    Explorer, Finder, a .desktop entry -- which hands it a PATH that no login
    profile ever touched. On Windows that PATH can predate a runtime installed
    in the same session; on macOS and Linux it never carries Homebrew, a Node
    version manager or an SDK at all. Surface the standard locations so `npm`
    and Maven's wrapper resolve however the app was started. */
export function runtimeEnvironment(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  return process.platform === "win32" ? windowsRuntimeEnvironment(env) : posixRuntimeEnvironment(env);
}

function windowsRuntimeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  for (const directory of windowsNodeDirectories(env)) addPathEntry(env, directory, "npm.cmd");
  const javaHome = env.JAVA_HOME && existsSync(join(env.JAVA_HOME, "bin", "java.exe"))
    ? env.JAVA_HOME
    : javaHomeAmong(windowsJavaCandidates(env), "java.exe", "javac.exe");
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    addPathEntry(env, join(javaHome, "bin"), "java.exe");
  }
  return env;
}

export function windowsNodeDirectories(env: NodeJS.ProcessEnv): readonly string[] {
  const programFiles = env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const programData = env.ProgramData ?? "C:\\ProgramData";
  const home = env.USERPROFILE ?? homedir();
  // Weakest to strongest, as on POSIX: entries are prepended, so a version
  // manager's shims end up ahead of a machine-wide install.
  return [
    win32.join(programFilesX86, "nodejs"),
    win32.join(programFiles, "nodejs"),
    win32.join(programData, "chocolatey", "bin"),
    win32.join(home, "scoop", "shims"),
    win32.join(home, ".volta", "bin"),
  ];
}

/** No JDK vendor owns Windows the way a package manager owns macOS, so each
    ships into its own directory under Program Files and naming one is naming
    the wrong one on most machines. These are the directories their installers
    create; what is inside them is the machine's business. */
export function windowsJavaRoots(env: NodeJS.ProcessEnv): readonly string[] {
  const roots = [env.ProgramFiles ?? "C:\\Program Files", env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"];
  const vendors = ["Microsoft", "Eclipse Adoptium", "Amazon Corretto", "Zulu", "Java", "AdoptOpenJDK", "BellSoft", "Semeru"];
  return roots.flatMap((root) => vendors.map((vendor) => win32.join(root, vendor)));
}

/** Newest first within a vendor, so a machine holding 17 and 21 runs 21. */
function windowsJavaCandidates(env: NodeJS.ProcessEnv): readonly string[] {
  return windowsJavaRoots(env).flatMap((root) => newestFirst(root));
}

function posixRuntimeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const home = env.HOME ?? homedir();
  // Entries are prepended, so the list runs from weakest to strongest: a
  // version manager's shims must win over a system-wide install, the way the
  // operator's own shell would resolve them.
  for (const directory of posixNodeDirectories(home)) addPathEntry(env, directory, "npm");
  const javaHome = env.JAVA_HOME && existsSync(join(env.JAVA_HOME, "bin", "java"))
    ? env.JAVA_HOME
    : javaHomeAmong(posixJavaCandidates(home), "java", "javac");
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    addPathEntry(env, join(javaHome, "bin"), "java");
  }
  return env;
}

function posixNodeDirectories(home: string): readonly string[] {
  return [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    join(home, ".local/bin"),
    // nvm keeps one directory per installed release and no stable `current`
    // symlink. Only the newest stands in for the version manager's default:
    // putting every installed release on PATH would let an older one win.
    ...newestFirst(join(home, ".nvm/versions/node")).slice(0, 1).map((directory) => join(directory, "bin")),
    join(home, ".asdf/shims"),
    join(home, ".local/share/mise/shims"),
    join(home, ".volta/bin"),
  ];
}

function posixJavaCandidates(home: string): readonly string[] {
  return [
    join(home, ".sdkman/candidates/java/current"),
    ...newestFirst("/Library/Java/JavaVirtualMachines").map((directory) => join(directory, "Contents/Home")),
    "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
    "/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
    ...newestFirst("/usr/lib/jvm"),
  ];
}

/** A runtime carries `java` too, and both platforms keep JREs beside JDKs --
    `Program Files\\Java` holds `jre1.8` next to `jdk-21`, and a Linux
    `/usr/lib/jvm` holds `java-17-openjdk` next to its headless runtime. Maven's
    wrapper needs something that compiles, so prefer a directory that can, and
    settle for one that merely runs only when nothing else is installed. */
function javaHomeAmong(candidates: readonly string[], runtime: string, compiler: string): string | undefined {
  return candidates.find((directory) => existsSync(join(directory, "bin", compiler)))
    ?? candidates.find((directory) => existsSync(join(directory, "bin", runtime)));
}

/** Version directories sort by name, which for `jdk-21` or `v24.3.0` puts the
    newest release first without parsing a version scheme per vendor. */
function newestFirst(parent: string): readonly string[] {
  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, "en", { numeric: true }))
      .map((name) => join(parent, name));
  } catch {
    return [];
  }
}

function addPathEntry(env: NodeJS.ProcessEnv, directory: string, executable: string): void {
  if (!existsSync(join(directory, executable))) return;
  const windows = process.platform === "win32";
  const separator = windows ? ";" : ":";
  // Windows environment blocks are case-insensitive and the key is spelled
  // `Path` there; a POSIX block is case-sensitive and only `PATH` is the one.
  const pathKey = windows ? Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path" : "PATH";
  const current = env[pathKey] ?? "";
  const present = current.split(separator).some((entry) => windows
    ? entry.toLowerCase() === directory.toLowerCase()
    : entry === directory);
  if (!present) env[pathKey] = current ? `${directory}${separator}${current}` : directory;
}

async function killGroup(child: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    // Negative PIDs are Unix process-group syntax and do not terminate a
    // Windows process tree. taskkill /T is the equivalent for npm/dev-server
    // children that outlive their direct parent.
    await new Promise<void>((resolve) => {
      execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], (error) => {
        if (error) {
          try { child.kill(signal); } catch { /* the process may have exited */ }
        }
        resolve();
      });
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* the process may have exited */ }
  }
}
