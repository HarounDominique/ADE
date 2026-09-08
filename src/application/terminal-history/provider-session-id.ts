import { closeSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import type { TerminalAgentProvider } from "./agent-terminal.js";

export type ProviderSessionLookup = {
  repositoryPath: string;
  startedAt: string;
  endedAt: string;
  home?: string | undefined;
  takenIds?: readonly string[] | undefined;
  /** Test seam for Windows path matching on non-Windows CI runners. */
  platform?: NodeJS.Platform | undefined;
};

/** The agent writes its first line a moment after the command is recognised.
    The allowance is deliberately tiny: a conversation is born *during* the
    session, never after it ends, and every millisecond of slack past the close
    is a chance to sweep in the conversation that started next. */
const creationGraceMs = 2_000;
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Candidate = { id: string; createdAt: number; path: string };

/** Codex records the native spelling of its working directory. Windows treats
    drive and directory casing as equivalent, while callers may arrive with
    either slash convention, so compare canonical Windows identities rather
    than the raw strings persisted by two independent processes. */
export function comparableRepositoryPath(path: string, platform = process.platform): string {
  if (platform !== "win32") return path;
  const withoutExtendedPrefix = path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "");
  return win32.normalize(withoutExtendedPrefix).replaceAll("\\", "/").toLowerCase();
}

/** Claude names a project directory after the working directory, with every
    character that is not alphanumeric folded to a dash. */
function claudeProjectDirectory(repositoryPath: string): string {
  return repositoryPath.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Creation time, not modification time, is what ties a conversation to a
    terminal. Any long-lived agent session in the same directory -- the editor's
    own, or another window -- is written to constantly, so by modification time
    it is always the most recent file and would win every lookup. It was born
    before this terminal opened, and that is what rules it out.

    A filesystem that records no birth time reports 0; with no creation time to
    go on the honest answer is no match, which costs the operator the picker
    rather than the wrong conversation. */
function createdWithin(path: string, from: number, to: number): number | undefined {
  try {
    // birthtimeMs carries sub-millisecond precision that an ISO-8601 bound
    // cannot express, so a file born in the closing millisecond would compare
    // as born after it.
    const createdAt = Math.floor(statSync(path).birthtimeMs);
    if (!createdAt) return undefined;
    return createdAt >= from && createdAt <= to ? createdAt : undefined;
  } catch {
    return undefined;
  }
}

function listFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function listDirectories(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** Only the first line is needed, and a rollout can be megabytes. */
function readFirstLine(path: string): string {
  let handle: number | undefined;
  try {
    handle = openSync(path, "r");
    const buffer = Buffer.alloc(65_536);
    const read = readSync(handle, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, read).toString("utf8");
    const newline = text.indexOf("\n");
    return newline < 0 ? text : text.slice(0, newline);
  } catch {
    return "";
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

function claudeCandidates(home: string, lookup: ProviderSessionLookup, from: number, to: number): Candidate[] {
  const directory = join(home, ".claude", "projects", claudeProjectDirectory(lookup.repositoryPath));
  const candidates: Candidate[] = [];
  for (const name of listFiles(directory)) {
    if (!name.endsWith(".jsonl")) continue;
    const id = name.slice(0, -".jsonl".length);
    if (!uuid.test(id)) continue;
    const path = join(directory, name);
    const createdAt = createdWithin(path, from, to);
    if (createdAt !== undefined) candidates.push({ id, createdAt, path });
  }
  return candidates;
}

/** Codex partitions by date and records the working directory in its first
    `session_meta` line, so the directory has to be read rather than inferred. */
function codexCandidates(home: string, lookup: ProviderSessionLookup, from: number, to: number): Candidate[] {
  const root = join(home, ".codex", "sessions");
  const candidates: Candidate[] = [];
  for (const year of listDirectories(root)) {
    for (const month of listDirectories(join(root, year))) {
      for (const day of listDirectories(join(root, year, month))) {
        const directory = join(root, year, month, day);
        for (const name of listFiles(directory)) {
          if (!name.startsWith("rollout-") || !name.endsWith(".jsonl")) continue;
          const path = join(directory, name);
          const createdAt = createdWithin(path, from, to);
          if (createdAt === undefined) continue;
          const meta = readFirstLine(path);
          if (!meta) continue;
          try {
            const payload = (JSON.parse(meta) as { payload?: { cwd?: string; session_id?: string } }).payload;
            if (!payload || typeof payload.cwd !== "string" || comparableRepositoryPath(payload.cwd, lookup.platform) !== comparableRepositoryPath(lookup.repositoryPath, lookup.platform)) continue;
            const id = payload.session_id;
            if (id && uuid.test(id)) candidates.push({ id, createdAt, path });
          } catch {
            continue;
          }
        }
      }
    }
  }
  return candidates;
}

/** Reads the agent's own session store to learn which conversation a terminal
    ran, so it can later be resumed by id. The provider is never inferred here:
    it is already known from the executable the operator typed.

    The window is exactly the session's: a conversation is born while the agent
    runs, never after the terminal closed, and slack past the close only invites
    the conversation that started next.

    Exactly one candidate is a match; anything else is a guess. Taking the most
    recent of several is what sent an operator into the conversation they were
    having with the editor, so several candidates now resolve to nothing and the
    operator gets the provider's picker instead of the wrong conversation.

    OpenCode keeps its sessions in a SQLite database with no per-session CLI
    resume, so it has no id to record. */
export function resolveProviderSessionId(provider: TerminalAgentProvider, lookup: ProviderSessionLookup): string | undefined {
  if (provider === "opencode") return undefined;
  const from = Date.parse(lookup.startedAt);
  const to = Date.parse(lookup.endedAt);
  if (Number.isNaN(from) || Number.isNaN(to) || !lookup.repositoryPath) return undefined;
  const home = lookup.home ?? homedir();
  const taken = new Set(lookup.takenIds ?? []);
  const candidates = provider === "claude"
    ? claudeCandidates(home, lookup, from, to)
    : codexCandidates(home, lookup, from, to);
  const unclaimed = candidates.filter((candidate) => !taken.has(candidate.id));
  return unclaimed.length === 1 ? unclaimed[0]!.id : undefined;
}
