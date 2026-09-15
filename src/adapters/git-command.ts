import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const gitRetryDelaysMs = [50, 100, 200] as const;

export class GitUnavailableError extends Error {
  readonly code = "GIT_UNAVAILABLE";

  constructor() {
    super("Git is not available. Install Git for this account or set ADE_GIT_COMMAND to its executable path.");
  }
}

export class GitRepositoryMissingError extends Error {
  readonly code = "GIT_REPOSITORY_MISSING";

  constructor() {
    super("This folder is no longer a Git repository.");
  }
}

/** Desktop apps inherit the launcher's environment, not the operator's login
    shell. Resolve standard Git for Windows locations before falling back to
    PATH, while leaving a deliberate ADE_GIT_COMMAND override untouched. */
export function gitExecutable(
  environment: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
  fileExists: (path: string) => boolean = existsSync,
): string {
  const explicit = environment.ADE_GIT_COMMAND?.trim();
  if (explicit) return explicit;
  const command = platform === "win32" ? "git.exe" : "git";
  const candidates = platform === "win32"
    ? windowsGitCandidates(environment)
    : posixGitCandidates(environment);
  return candidates.find(fileExists) ?? pathGitCommand(environment, command, platform, fileExists) ?? command;
}

/** A launcher's PATH is short, but an operator's Git can still live outside the
    standard prefixes, so the inherited PATH is searched before giving up on a
    bare command name that only resolves inside a login shell. */
function pathGitCommand(
  environment: NodeJS.ProcessEnv,
  command: string,
  platform: NodeJS.Platform | string,
  fileExists: (path: string) => boolean,
): string | undefined {
  const windows = platform === "win32";
  const search = environment.PATH ?? environment.Path ?? "";
  for (const directory of search.split(windows ? ";" : ":")) {
    const trimmed = windows ? directory.replace(/^"|"$/g, "").trim() : directory;
    if (!trimmed) continue;
    const candidate = windows ? win32.join(trimmed, command) : posix.join(trimmed, command);
    if (fileExists(candidate)) return candidate;
  }
  return undefined;
}

function posixGitCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const home = environment.HOME ?? homedir();
  return [
    "/usr/bin/git",
    "/usr/local/bin/git",
    "/opt/homebrew/bin/git",
    "/Library/Developer/CommandLineTools/usr/bin/git",
    "/opt/local/bin/git",
    posix.join(home, ".local", "bin", "git"),
  ];
}

function windowsGitCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const programFiles = environment.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = environment["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const programData = environment.ProgramData ?? "C:\\ProgramData";
  const home = environment.USERPROFILE ?? homedir();
  const localAppData = environment.LOCALAPPDATA ?? win32.join(home, "AppData", "Local");
  return [
    win32.join(programFiles, "Git", "cmd", "git.exe"),
    win32.join(programFiles, "Git", "bin", "git.exe"),
    win32.join(programFilesX86, "Git", "cmd", "git.exe"),
    win32.join(programData, "chocolatey", "bin", "git.exe"),
    win32.join(home, "scoop", "shims", "git.exe"),
    win32.join(localAppData, "Programs", "Git", "cmd", "git.exe"),
  ];
}

export async function executeGit(args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number }): Promise<{ stdout: string; stderr: string }> {
  const { env, maxBuffer, ...rest } = options ?? {};
  const commandOptions = { encoding: "utf8" as const, windowsHide: true, maxBuffer: maxBuffer ?? 64 * 1024 * 1024, ...rest, ...(env ? { env: { ...process.env, ...env } } : {}) };
  for (let attempt = 0; ; attempt += 1) {
    try {
      // Git is a console application: without this, every read of the repository
      // flashes a window on Windows. The bounded retry handles antivirus/indexer
      // locks that release moments after a temporary repository operation.
      return await execFile(gitExecutable(), args, commandOptions);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") throw new GitUnavailableError();
      if (!isTransientGitLockError(error) || attempt >= gitRetryDelaysMs.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, gitRetryDelaysMs[attempt]));
    }
  }
}

/** Windows can briefly hold `.git/index` or its lock while antivirus/indexing
 * catches up. Keep this classifier narrow so real Git errors remain immediate. */
export function isTransientGitLockError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: unknown; stderr?: unknown; code?: unknown };
  if (value.code === "ENOENT") return false;
  const text = `${String(value.message ?? "")}\n${String(value.stderr ?? "")}`;
  return /(?:\.git[\\/]index(?:\.lock)?|index file open failed|could not lock .*index)/i.test(text)
    && /(permission denied|access is denied|being used by another process|resource busy|temporarily unavailable)/i.test(text);
}

export async function isInsideGitWorkTree(directory: string): Promise<boolean> {
  return executeGit(["rev-parse", "--is-inside-work-tree"], { cwd: directory })
    .then(() => true)
    .catch(() => false);
}
