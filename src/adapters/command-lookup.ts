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

function runnable(candidate: string): string | undefined {
  try { accessSync(candidate, constants.X_OK); return candidate; } catch { return undefined; }
}

function onPath(command: string): string | undefined {
  const separator = process.platform === "win32" ? ";" : ":";
  for (const directory of (process.env.PATH ?? "").split(separator).filter(Boolean)) {
    const found = runnable(join(directory, command));
    if (found) return found;
  }
  return undefined;
}

/** A spawn that cannot find its program says only the path it tried last. The
    operator needs to know every place ADE looked and how to override it. */
export function missingCommandError(error: unknown, tool: string, variable: string, searched: readonly string[]): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("ENOENT")) return error instanceof Error ? error : new Error(message);
  return new Error(`${tool} was not found or could not be run. ADE tried: ${searched.join(", ")}. Install it, or set ${variable} to the binary ADE should run.`);
}
