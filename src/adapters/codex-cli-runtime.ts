import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentPermission, AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt, TurnUsage, ProviderPressure, UsageWindow } from "../ports/agent-runtime.js";
import { executeGit } from "./git-command.js";
import { startSafeCommand } from "./safe-command.js";
import { firstRunnable, missingCommandError } from "./command-lookup.js";

// Codex is installed in several ways and ADE owns none of them, so the command
// is resolved rather than assumed: the environment override first, then a
// `codex` the PATH can reach, then the places installers are known to use, and
// ChatGPT's bundled copy last -- a binary inside another application's bundle
// is the least stable of the lot, and macOS may refuse to execute it at all.
// Windows names the `.exe` explicitly: calling the extensionless `codex` makes
// Node route through cmd.exe, which splits a natural-language prompt into
// separate command arguments.
const codexCandidates = (): readonly string[] => {
  if (process.platform === "win32") return ["codex.exe", "codex"];
  const home = process.env.HOME ?? "";
  const installed = [
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    ...(home ? [`${home}/.codex/bin/codex`, `${home}/.local/bin/codex`] : []),
  ];
  return process.platform === "darwin"
    ? ["codex", ...installed, "/Applications/ChatGPT.app/Contents/Resources/codex"]
    : ["codex", ...installed];
};

export function resolveCodexCommand(): string {
  const override = process.env.ADE_CODEX_COMMAND;
  if (override) return override;
  return firstRunnable(codexCandidates()) ?? codexCandidates().at(-1)!;
}

/** What ADE looked for, so a failure to find Codex can be read instead of
    guessed at. */
export function codexSearchPath(): readonly string[] {
  return process.env.ADE_CODEX_COMMAND ? [process.env.ADE_CODEX_COMMAND] : codexCandidates();
}

export const defaultCodexCommand = resolveCodexCommand();

type CommandRunner = (command: string, args: string[], options: { cwd: string; maxBuffer: number; shell?: boolean; onStdout?: (text: string) => void }) => Promise<{ stdout: string }>;

const execute: CommandRunner = (command, args, options) => startSafeCommand(command, args, options).completion;

export const executeCodexCommand = execute;

export class CodexCliRuntime implements AgentRuntimePort {
  private activeChild: ChildProcess | undefined;

  constructor(private readonly command = resolveCodexCommand(), private readonly runner: CommandRunner = execute) {}

  async health(): Promise<{ healthy: boolean; version?: string }> {
    try { const { stdout } = await this.runner(this.command, ["--version"], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }); return { healthy: true, version: stdout.trim() }; }
    catch { return { healthy: false }; }
  }

  async createSession(input: { directory: string; title?: string }): Promise<SessionHandle> {
    return { id: `codex-pending-${randomUUID()}`, directory: input.directory };
  }

  async prompt(session: SessionHandle, input: { text: string; model?: string; grantedPermissions?: readonly AgentPermission[]; onEvent?: (event: RuntimeEvent) => void }): Promise<unknown> {
    return this.executePrompt(session, input.text, input.grantedPermissions, input.model, input.onEvent);
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const stdout = await this.executePrompt(session, input.text, [], input.model);
    return { output: stdout.trim(), provider: "codex" };
  }

  async *events(): AsyncIterable<RuntimeEvent> { return; }
  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const { stdout } = await executeGit(["diff", "--numstat"], { cwd: session.directory });
    return stdout.split("\n").filter(Boolean).map((line) => { const [additions, deletions, path] = line.split("\t"); return { ...(path ? { path } : {}), additions: Number(additions), deletions: Number(deletions) }; });
  }
  async abort(): Promise<void> {
    const child = this.activeChild;
    if (!child || child.killed) return;
    child.kill("SIGTERM");
    const escalation = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 1_500);
    escalation.unref();
  }

  private async executePrompt(session: SessionHandle, text: string, grantedPermissions: readonly AgentPermission[] = [], model?: string, onEvent?: (event: RuntimeEvent) => void): Promise<string> {
    const isNew = session.id.startsWith("codex-pending-");
    const sandbox = grantedPermissions.some((permission) => ["write_code", "write_docs"].includes(permission)) ? "workspace-write" : "read-only";
    const args = [
      ...(grantedPermissions.includes("network") ? ["--search"] : []),
      // A resumed Codex session owns its model. Repeating a model from the UI
      // can silently switch it (or, for retired ids, make the CLI fall back)
      // and then fail the turn with a model-mismatch warning.
      ...(isNew && model ? ["--model", normalizeCodexModel(model)] : []),
      "exec",
      "--sandbox",
      sandbox,
      ...(isNew ? ["--cd", session.directory] : ["resume", session.id]),
      "--json",
      text,
    ];
    const { stdout } = await this.runPromptCommand(args, session.directory, onEvent);
    if (isNew) {
      const realSessionId = extractCodexSessionId(stdout);
      if (!realSessionId) throw new Error("Codex completed without reporting a resumable session id");
      session.id = realSessionId;
    }
    return stdout;
  }

  /** A turn that cannot find its CLI says where ADE looked, so the operator can
      install it or point ADE at it instead of reading a bare ENOENT. */
  private describeMissing(error: unknown, cwd?: string): Error {
    return missingCommandError(error, "Codex", "ADE_CODEX_COMMAND", codexSearchPath(), { command: this.command, ...(cwd ? { cwd } : {}) });
  }

  private runPromptCommand(args: string[], cwd: string, onEvent?: (event: RuntimeEvent) => void): Promise<{ stdout: string }> {
    const jsonl = createJsonlEventEmitter((event) => onEvent?.({ type: "codex.event", payload: event }));
    if (this.runner !== execute) {
      return this.runner(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push }).finally(jsonl.flush);
    }
    const command = startSafeCommand(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push });
    this.activeChild = command.child;
    return command.completion.catch((error: unknown) => { throw this.describeMissing(error, cwd); }).finally(() => {
      jsonl.flush();
      if (this.activeChild === command.child) this.activeChild = undefined;
    });
  }
}

function createJsonlEventEmitter(onEvent: (event: Record<string, unknown>) => void): { push: (text: string) => void; flush: () => void } {
  let buffer = "";
  const consume = (line: string) => {
    if (!line.trim()) return;
    try { onEvent(JSON.parse(line) as Record<string, unknown>); } catch { /* Human-readable diagnostics are not stream events. */ }
  };
  return {
    push(text) {
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(consume);
    },
    flush() { consume(buffer); buffer = ""; },
  };
}

function normalizeCodexModel(model: string): string {
  // ChatGPT-authenticated Codex retired these aliases on 2026-08-31. Keep
  // existing UI settings usable while directing new sessions to their current
  // replacements. API-key based custom commands can still use an override.
  if (model === "gpt-5.4") return "gpt-5.6-terra";
  if (model === "gpt-5.4-mini") return "gpt-5.6-luna";
  return model;
}


export function extractCodexSessionId(jsonl: string): string | undefined {
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const thread = event.thread as Record<string, unknown> | undefined;
      const session = event.session as Record<string, unknown> | undefined;
      const candidate = event.thread_id ?? event.session_id ?? thread?.id ?? session?.id;
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    } catch { /* A final text line does not carry a session id. */ }
  }
  return undefined;
}

/** Codex reports `total_token_usage` as a running total for the whole thread,
    not for the turn that just ran, so the caller subtracts what it already
    recorded for the session. Its `input_tokens` counts cached tokens too; ADE
    stores them apart, as Claude Code already reports them, so a row means the
    same thing whichever provider produced it. */
export function extractCodexUsage(jsonl: unknown): TurnUsage | undefined {
  if (typeof jsonl !== "string") return undefined;
  for (const line of jsonl.split(/\r?\n/).reverse()) {
    if (!line.trim()) continue;
    let event: unknown;
    try { event = JSON.parse(line); } catch { continue; }
    const usage = findCodexUsage(event);
    if (usage) return usage;
  }
  return undefined;
}

function findCodexUsage(value: unknown, depth = 0): TurnUsage | undefined {
  if (!value || typeof value !== "object" || depth > 6) return undefined;
  const node = value as Record<string, unknown>;
  const totals = node.total_token_usage;
  if (totals && typeof totals === "object") return findCodexUsage(totals, depth + 1);
  const input = node.input_tokens;
  const output = node.output_tokens;
  if (typeof input === "number" || typeof output === "number") {
    const count = (candidate: unknown): number => (typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0);
    const cached = count(node.cached_input_tokens);
    return { inputTokens: Math.max(count(input) - cached, 0), outputTokens: count(output), cacheReadInputTokens: cached, cacheCreationInputTokens: 0 };
  }
  for (const child of Object.values(node)) {
    const usage = findCodexUsage(child, depth + 1);
    if (usage) return usage;
  }
  return undefined;
}

/** Codex reports both halves in its `token_count` event: what the context
    window is holding after the last request, and the plan windows with the
    percentage already used. The five-hour window is the session one and the
    weekly window the second; they are told apart by their own length, not by
    the order the CLI happens to send them in. */
export function extractCodexPressure(event: unknown): ProviderPressure | undefined {
  const info = findCodexTokenCount(event);
  if (!info) return undefined;
  const last = info.last_token_usage as Record<string, unknown> | undefined;
  const windowTokens = typeof info.model_context_window === "number" ? info.model_context_window : undefined;
  const usedTokens = codexContextTokens(last);
  const windows = readCodexLimits(info.rate_limits);
  return {
    ...(typeof usedTokens === "number" ? { context: { usedTokens, ...(windowTokens ? { windowTokens } : {}) } } : {}),
    ...windows,
  };
}

function findCodexTokenCount(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || depth > 6) return undefined;
  const node = value as Record<string, unknown>;
  if (node.rate_limits || node.model_context_window || node.last_token_usage) return node;
  /** `exec --json` reports no plan windows and no context size: what a turn put
      in the window arrives once, in `turn.completed`. Reading it means the
      context dial says how much was used even when nothing says of how much. */
  if (node.type === "turn.completed" && node.usage && typeof node.usage === "object") return { last_token_usage: node.usage };
  for (const child of Object.values(node)) {
    const found = findCodexTokenCount(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** The context holds the whole last request, cached tokens included: what is
    stored apart for accounting is still occupying the window. */
function codexContextTokens(usage: Record<string, unknown> | undefined): number | undefined {
  if (!usage) return undefined;
  const total = usage.total_tokens;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const input = usage.input_tokens;
  const output = usage.output_tokens;
  if (typeof input !== "number" && typeof output !== "number") return undefined;
  return (typeof input === "number" ? input : 0) + (typeof output === "number" ? output : 0);
}

function readCodexLimits(value: unknown): { session?: UsageWindow; weekly?: UsageWindow } {
  if (!value || typeof value !== "object") return {};
  const limits = value as Record<string, unknown>;
  const result: { session?: UsageWindow; weekly?: UsageWindow } = {};
  for (const candidate of Object.values(limits)) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    const used = entry.used_percent;
    if (typeof used !== "number" || !Number.isFinite(used)) continue;
    const minutes = typeof entry.window_minutes === "number" ? entry.window_minutes : undefined;
    const resets = typeof entry.resets_in_seconds === "number" ? new Date(Date.now() + entry.resets_in_seconds * 1_000).toISOString() : undefined;
    const window: UsageWindow = { usedPercent: used, ...(minutes ? { windowMinutes: minutes } : {}), ...(resets ? { resetsAt: resets } : {}) };
    // A window ADE cannot measure is treated as the session one only when no
    // shorter window has claimed that place.
    const isWeekly = minutes !== undefined && minutes > 1_440;
    if (isWeekly) { if (!result.weekly) result.weekly = window; }
    else if (!result.session) result.session = window;
  }
  return result;
}
