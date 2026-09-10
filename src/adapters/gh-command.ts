import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

/** The GitHub CLI is resolved like Git and like ASK, and for the same reason:
    an application opened from the desktop inherits a short PATH, so a `gh`
    installed through winget, scoop or Homebrew is often unreachable under the
    bare name even though the operator has it. Reporting "GitHub CLI
    unavailable" in that case is a lie about their machine. */
export function ghExecutable(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform | string = process.platform,
  fileExists: (path: string) => boolean = existsSync,
): string {
  const explicit = environment.ADE_GH_COMMAND?.trim();
  if (explicit) return explicit;
  const windows = platform === "win32";
  const command = windows ? "gh.exe" : "gh";
  const candidates = windows ? windowsGhCandidates(environment) : posixGhCandidates(environment);
  return pathGhCommand(environment, command, windows, fileExists) ?? candidates.find(fileExists) ?? command;
}

function pathGhCommand(
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

function posixGhCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const home = environment.HOME ?? homedir();
  return [
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "/usr/bin/gh",
    posix.join(home, ".local", "bin", "gh"),
  ];
}

/** Where each Windows installer leaves it: winget and the MSI under Program
    Files, then the package managers a developer is likelier to have used. */
function windowsGhCandidates(environment: NodeJS.ProcessEnv): readonly string[] {
  const programFiles = environment.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = environment["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const programData = environment.ProgramData ?? "C:\\ProgramData";
  const home = environment.USERPROFILE ?? homedir();
  const localAppData = environment.LOCALAPPDATA ?? win32.join(home, "AppData", "Local");
  return [
    win32.join(programFiles, "GitHub CLI", "gh.exe"),
    win32.join(programFilesX86, "GitHub CLI", "gh.exe"),
    win32.join(programData, "chocolatey", "bin", "gh.exe"),
    win32.join(home, "scoop", "shims", "gh.exe"),
    win32.join(localAppData, "Microsoft", "WinGet", "Links", "gh.exe"),
  ];
}
