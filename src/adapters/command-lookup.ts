import { accessSync, constants } from "node:fs";
import { join } from "node:path";

/** A candidate is accepted only when it is there and executable by this
    process, so a path that exists but cannot be run does not shadow one that
    can. A bare command is looked up on the PATH rather than left to the spawn,
    because an application launched from the desktop inherits a minimal PATH
    that rarely contains what a developer installed. */
export function firstRunnable(candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    const resolved = candidate.includes("/") || candidate.includes("\\") ? runnable(candidate) : onPath(candidate);
    if (resolved) return resolved;
  }
  return undefined;
}

const windows = process.platform === "win32";

/** What each system means by "can be run". A permission bit says it on POSIX;
    Windows has no such bit and answers `X_OK` for any file that exists, so
    asking it that question accepts a text file as a program. There the answer
    is the extension, and `PATHEXT` is where the machine keeps the list. */
function executableExtensions(): readonly string[] {
  return (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean);
}

function looksExecutable(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  return executableExtensions().some((extension) => lower.endsWith(extension));
}

function runnable(candidate: string): string | undefined {
  try { accessSync(candidate, windows ? constants.F_OK : constants.X_OK); } catch { return undefined; }
  return windows && !looksExecutable(candidate) ? undefined : candidate;
}

/** A bare command on Windows is spelled without its extension, and the system
    finds it by trying each one on `PATHEXT` in turn. */
function spellings(command: string): readonly string[] {
  if (!windows || looksExecutable(command)) return [command];
  return [command, ...executableExtensions().map((extension) => `${command}${extension}`)];
}

function onPath(command: string): string | undefined {
  const separator = windows ? ";" : ":";
  for (const directory of (process.env.PATH ?? "").split(separator).filter(Boolean)) {
    for (const spelling of spellings(command)) {
      const found = runnable(join(directory, spelling));
      if (found) return found;
    }
  }
  return undefined;
}

/** A spawn that cannot find its program says only the path it tried last. The
    operator needs to know every place ADE looked, what ADE can see of the one
    it chose, and how to override it -- `ENOENT` is also what the system
    returns when the working directory is gone, or when it refuses to run a
    binary that is plainly there, and those are different problems. */
export function missingCommandError(
  error: unknown,
  tool: string,
  variable: string,
  searched: readonly string[],
  context: { command?: string; cwd?: string } = {},
): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("ENOENT")) return error instanceof Error ? error : new Error(message);
  const parts = [`${tool} could not be run.`];
  if (context.command) parts.push(`Chosen binary: ${context.command} (${describePath(context.command, constants.X_OK)}).`);
  if (context.cwd) parts.push(`Working directory: ${context.cwd} (${describePath(context.cwd, constants.R_OK)}).`);
  parts.push(`ADE tried: ${searched.join(", ")}.`);
  parts.push(`Install it, or set ${variable} to the binary ADE should run.`);
  parts.push(`System said: ${message}`);
  return new Error(parts.join(" "));
}

function describePath(target: string, mode: number): string {
  try { accessSync(target, constants.F_OK); } catch { return "missing"; }
  // Windows would answer "permitted" for a text file, so the extension answers
  // instead: the operator is told the file is there and is not a program.
  if (windows && mode === constants.X_OK && !looksExecutable(target)) return "present but not a program this system runs";
  try { accessSync(target, mode); return "present and permitted"; } catch { return "present but this process may not use it"; }
}
