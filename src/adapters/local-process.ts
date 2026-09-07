import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ProcessDefinition,
  ProcessEvidence,
  ProcessHandle,
  ProcessPort,
} from "../ports/process.js";

export class LocalProcess implements ProcessPort {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly output = new Map<string, { stdout: string; stderr: string }>();

  async start(definition: ProcessDefinition): Promise<ProcessHandle> {
    const child = spawn(definition.command, [...(definition.args ?? [])], {
      cwd: definition.cwd,
      env: runtimeEnvironment(definition.env),
      stdio: "pipe",
      // npm and many Windows CLIs are .cmd shims rather than PE executables.
      shell: windowsCommandNeedsShell(definition.command),
      detached: true,
    });
    const output = { stdout: "", stderr: "" };
    child.stdout.on("data", (chunk: Buffer) => { const text = chunk.toString(); output.stdout += text; definition.onOutput?.({ stream: "stdout", text }); });
    child.stderr.on("data", (chunk: Buffer) => { const text = chunk.toString(); output.stderr += text; definition.onOutput?.({ stream: "stderr", text }); });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
    const id = definition.id;
    this.processes.set(id, child);
    this.output.set(id, output);
    child.once("close", () => {
      this.processes.delete(id);
    });
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

function windowsCommandNeedsShell(command: string): boolean {
  return process.platform === "win32" && (!/\.[^\\/]+$/.test(command) || /\.(?:cmd|bat)$/i.test(command));
}

/** A packaged desktop app can be launched by Explorer before its process PATH
    sees a Node installation made during the same session. npm is a .cmd shim,
    so give child commands the standard Node location when it exists. */
function runtimeEnvironment(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  if (process.platform !== "win32") return env;
  const nodeDirectory = join(env.ProgramFiles ?? "C:\\Program Files", "nodejs");
  if (!existsSync(join(nodeDirectory, "npm.cmd"))) return env;
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path";
  const current = env[pathKey] ?? "";
  if (!current.split(";").some((entry) => entry.toLowerCase() === nodeDirectory.toLowerCase())) {
    env[pathKey] = current ? `${nodeDirectory};${current}` : nodeDirectory;
  }
  return env;
}

async function killGroup(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): Promise<void> {
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
