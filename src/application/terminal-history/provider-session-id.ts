import { closeSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TerminalAgentProvider } from "./agent-terminal.js";

export type ProviderSessionLookup = {
  repositoryPath: string;
  startedAt: string;
  endedAt: string;
  home?: string | undefined;
  takenIds?: readonly string[] | undefined;
};

/** A session file is still being written when the tab closes, so its last write
    can land just after the recorded end. Anything wider would start claiming the
    next conversation. */
const trailingWriteGraceMs = 120_000;
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Candidate = { id: string; modifiedAt: number; path: string };

/** Claude names a project directory after the working directory, with every
    character that is not alphanumeric folded to a dash. */
function claudeProjectDirectory(repositoryPath: string): string {
  return repositoryPath.replace(/[^a-zA-Z0-9]/g, "-");
}

function modifiedWithin(path: string, from: number, to: number): number | undefined {
  try {
    const modifiedAt = statSync(path).mtimeMs;
    return modifiedAt >= from && modifiedAt <= to ? modifiedAt : undefined;
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
    const modifiedAt = modifiedWithin(path, from, to);
    if (modifiedAt !== undefined) candidates.push({ id, modifiedAt, path });
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
          const modifiedAt = modifiedWithin(path, from, to);
          if (modifiedAt === undefined) continue;
          const meta = readFirstLine(path);
          if (!meta) continue;
          try {
            const payload = (JSON.parse(meta) as { payload?: { cwd?: string; session_id?: string } }).payload;
            if (!payload || payload.cwd !== lookup.repositoryPath) continue;
            const id = payload.session_id;
            if (id && uuid.test(id)) candidates.push({ id, modifiedAt, path });
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
    it is already known from the executable the operator typed. Returning
    undefined is the honest answer whenever the match is not unambiguous —
    resuming the wrong conversation is worse than offering the picker.

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
    ? claudeCandidates(home, lookup, from, to + trailingWriteGraceMs)
    : codexCandidates(home, lookup, from, to + trailingWriteGraceMs);
  return candidates
    .filter((candidate) => !taken.has(candidate.id))
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.id;
}
