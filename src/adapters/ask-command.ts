import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export class AskUnavailableError extends Error {
  readonly code = "ASK_UNAVAILABLE";

  constructor() {
    super("ASK Engine is not available. Install it with `pip install sourcecode` or set ADE_ASK_COMMAND to its executable path.");
  }
}

/** ASK is installed per interpreter -- a virtualenv, a pip --user prefix, a
    Homebrew shim -- so the operator's own PATH is the best evidence of which
    build they mean. A desktop launcher hands the app a short PATH, so the
    standard install prefixes are searched after it rather than instead of it. */
export function askExecutable(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform | string = process.platform,
  fileExists: (path: string) => boolean = existsSync,
): string {
  const explicit = environment.ADE_ASK_COMMAND?.trim();
  if (explicit) return explicit;
  const windows = platform === "win32";
  const command = windows ? "ask.exe" : "ask";
  const candidates = windows ? windowsAskCandidates(environment) : posixAskCandidates(environment);
  return pathAskCommand(environment, command, windows, fileExists) ?? candidates.find(fileExists) ?? command;
}

function pathAskCommand(
  environment: NodeJS.ProcessEnv,
  command: string,
  windows: boolean,
  fileExists: (path: string) => boolean,
): string | undefined {
  const search = environment.PATH ?? environment.Path ?? "";
  for (const directory of search.split(windows ? ";" : ":")) {
    const trimmed = windows ? directory.replace(/^"|"$/g, "").trim() : directory;
    if (!trimmed) continue;
    const candidate = windows ? win32.join(trimmed, command) : posix.join(trimmed, command);
    if (fileExists(candidate)) return candidate;
  }
  return undefined;
}

function posixAskCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const home = environment.HOME ?? homedir();
  return [
    posix.join(home, ".local", "bin", "ask"),
    "/opt/homebrew/bin/ask",
    "/usr/local/bin/ask",
    "/usr/bin/ask",
  ];
}

function windowsAskCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const home = environment.USERPROFILE ?? homedir();
  const appData = environment.APPDATA ?? win32.join(home, "AppData", "Roaming");
  const localAppData = environment.LOCALAPPDATA ?? win32.join(home, "AppData", "Local");
  return [
    win32.join(appData, "Python", "Scripts", "ask.exe"),
    win32.join(localAppData, "Programs", "Python", "Scripts", "ask.exe"),
    win32.join(home, ".local", "bin", "ask.exe"),
  ];
}

export type AskExecution = { stdout: string; stderr: string; exitCode: number };

/** A gate answers with its exit code -- 1 is BLOCK and 2 is UNVERIFIED -- so a
    non-zero exit is an answer to read, not a failure to raise. Only a process
    that never ran is an error here. */
export async function executeAsk(args: readonly string[], options?: { cwd?: string; maxBuffer?: number }): Promise<AskExecution> {
  const maxBuffer = options?.maxBuffer ?? 16 * 1024 * 1024;
  try {
    const { stdout, stderr } = await execFile(askExecutable(), [...args], { encoding: "utf8", maxBuffer, windowsHide: true, ...(options?.cwd ? { cwd: options.cwd } : {}) });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") throw new AskUnavailableError();
    const failure = error as { code?: unknown; stdout?: string; stderr?: string };
    if (typeof failure.code === "number") return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? "", exitCode: failure.code };
    throw error;
  }
}
