import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export class GitUnavailableError extends Error {
  readonly code = "GIT_UNAVAILABLE";

  constructor() {
    super("Git is not available. Install Git for this account or set ADE_GIT_COMMAND to its executable path.");
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
    : ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
  return candidates.find(fileExists) ?? command;
}

function windowsGitCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const programFiles = environment.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = environment["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const programData = environment.ProgramData ?? "C:\\ProgramData";
  const home = environment.USERPROFILE ?? homedir();
  const localAppData = environment.LOCALAPPDATA ?? join(home, "AppData", "Local");
  return [
    win32.join(programFiles, "Git", "cmd", "git.exe"),
    win32.join(programFiles, "Git", "bin", "git.exe"),
    win32.join(programFilesX86, "Git", "cmd", "git.exe"),
    win32.join(programData, "chocolatey", "bin", "git.exe"),
    win32.join(home, "scoop", "shims", "git.exe"),
    win32.join(localAppData, "Programs", "Git", "cmd", "git.exe"),
  ];
}

export async function executeGit(args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFile(gitExecutable(), args, { encoding: "utf8", ...options });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") throw new GitUnavailableError();
    throw error;
  }
}
