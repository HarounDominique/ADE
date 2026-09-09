import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentPermission, AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt, TurnUsage, ProviderPressure, UsageWindow } from "../ports/agent-runtime.js";
import { executeGit } from "./git-command.js";
import { firstRunnable, missingCommandError } from "./command-lookup.js";
import { startSafeCommand } from "./safe-command.js";

/** An app launched from the Dock inherits launchd's minimal PATH, not the
    shell's, so a bare `claude` can be unreachable exactly where the operator
    runs it. The command is resolved against the places it is installed rather
    than assumed to be on the PATH. */
const claudeCandidates = (): readonly string[] => {
  if (process.platform === "win32") return ["claude.exe", "claude"];
  const home = process.env.HOME ?? "";
  return [
    "claude",
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    ...(home ? [`${home}/.claude/local/claude`, `${home}/.local/bin/claude`] : []),
  ];
};

export function resolveClaudeCommand(): string {
  return process.env.ADE_CLAUDE_COMMAND ?? firstRunnable(claudeCandidates()) ?? "claude";
}

/** What ADE looked for, so "not found" can be read instead of guessed at. */
export function claudeSearchPath(): readonly string[] {
  return process.env.ADE_CLAUDE_COMMAND ? [process.env.ADE_CLAUDE_COMMAND] : claudeCandidates();
}

export const defaultClaudeCommand = resolveClaudeCommand();

type CommandRunner = (command: string, args: string[], options: { cwd: string; maxBuffer: number; shell?: boolean; onStdout?: (text: string) => void }) => Promise<{ stdout: string }>;

const execute: CommandRunner = (command, args, options) => startSafeCommand(command, args, options).completion;

export const executeClaudeCommand = execute;

export class ClaudeCliRuntime implements AgentRuntimePort {
  private activeChild: ChildProcess | undefined;

  constructor(private readonly command = resolveClaudeCommand(), private readonly runner: CommandRunner = execute) {}

  async health(): Promise<{ healthy: boolean; version?: string }> {
    try {
      const { stdout } = await this.runner(this.command, ["--version"], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 });
      return { healthy: true, version: stdout.trim() };
    } catch {
      return { healthy: false };
    }
  }

  async createSession(input: { directory: string; title?: string }): Promise<SessionHandle> {
    return { id: `claude-pending-${randomUUID()}`, directory: input.directory };
  }

  async prompt(session: SessionHandle, input: { text: string; model?: string; grantedPermissions?: readonly AgentPermission[]; onEvent?: (event: RuntimeEvent) => void }): Promise<unknown> {
    return this.executePrompt(session, input.text, input.grantedPermissions, input.model, undefined, input.onEvent);
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const stdout = await this.executePrompt(session, input.text, [], input.model, JSON.stringify(input.format.schema));
    return { output: extractClaudeText(stdout), provider: "claude" };
  }

  async *events(): AsyncIterable<RuntimeEvent> { return; }

  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const { stdout } = await executeGit(["diff", "--numstat"], { cwd: session.directory });
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [additions, deletions, path] = line.split("\t");
      return { ...(path ? { path } : {}), additions: Number(additions), deletions: Number(deletions) };
    });
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

  private async executePrompt(
    session: SessionHandle,
    text: string,
    grantedPermissions: readonly AgentPermission[] = [],
    model?: string,
    schema?: string,
    onEvent?: (event: RuntimeEvent) => void,
  ): Promise<string> {
    const isNew = session.id.startsWith("claude-pending-");
    const sessionId = isNew ? session.id.replace(/^claude-pending-/, "") : session.id;
    const writable = grantedPermissions.some((permission) => ["write_code", "write_docs"].includes(permission));
    const allowedTools = ["Read", "Glob", "Grep"];
    if (writable) allowedTools.push("Edit", "Write");
    if (grantedPermissions.includes("run_commands")) allowedTools.push("Bash");
    if (grantedPermissions.includes("network")) allowedTools.push("WebFetch", "WebSearch");
    // A read-only turn is not a planning turn. `plan` enforces a minimum model
    // tier and silently substitutes its own when the requested one is below it,
    // so a caller asking for Haiku got Sonnet. The allowed-tools list is what
    // actually keeps the turn read-only: an unlisted Write is denied outright
    // because non-interactive runs cannot prompt for permission.
    const args = [
      "--print",
      "--output-format", "stream-json",
      // The CLI refuses `--print --output-format stream-json` without it:
      // "when using --print, --output-format=stream-json requires --verbose".
      // Every Claude turn failed instantly until this was passed.
      "--verbose",
      "--include-partial-messages",
      "--permission-mode", writable ? "acceptEdits" : "default",
      "--permission-prompts", "none",
      "--allowed-tools", allowedTools.join(","),
      ...(model ? ["--model", model] : []),
      ...(schema ? ["--json-schema", schema] : []),
      ...(isNew ? ["--session-id", sessionId] : ["--resume", session.id]),
      text,
    ];
    const { stdout } = await this.runPromptCommand(args, session.directory, onEvent);
    if (isNew) session.id = extractClaudeSessionId(stdout) ?? sessionId;
    return stdout;
  }

  /** A turn that cannot find its CLI says where ADE looked, so the operator can
      install it or point ADE at it instead of reading a bare ENOENT. */
  private describeMissing(error: unknown): Error {
    return missingCommandError(error, "Claude Code", "ADE_CLAUDE_COMMAND", claudeSearchPath());
  }

  private runPromptCommand(args: string[], cwd: string, onEvent?: (event: RuntimeEvent) => void): Promise<{ stdout: string }> {
    const jsonl = createJsonlEventEmitter((event) => onEvent?.({ type: "claude.event", payload: event }));
    if (this.runner !== execute) {
      return this.runner(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push }).finally(jsonl.flush);
    }
    const command = startSafeCommand(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push });
    this.activeChild = command.child;
    return command.completion.catch((error: unknown) => { throw this.describeMissing(error); }).finally(() => {
      jsonl.flush();
      if (this.activeChild === command.child) this.activeChild = undefined;
    });
  }
}


export function extractClaudeSessionId(json: string): string | undefined {
  for (const line of json.split(/\r?\n/).reverse()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const candidate = event.session_id ?? event.sessionId;
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    } catch { /* Claude may emit a human-readable diagnostic line. */ }
  }
  return undefined;
}

export function extractClaudeText(output: unknown): string {
  if (typeof output !== "string") return output ? JSON.stringify(output) : "";
  const events = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
  });
  const result = [...events].reverse().find((event: Record<string, unknown>) => typeof event.result === "string")?.result;
  if (typeof result === "string" && result.trim()) return result.trim();
  const text = events.map(extractClaudeStreamText).filter(Boolean).join("");
  if (text.trim()) return text.trim();
  return output.trim();
}

function extractClaudeStreamText(event: Record<string, unknown>): string {
  const nested = event.event as Record<string, unknown> | undefined;
  const delta = nested?.delta as Record<string, unknown> | undefined;
  return typeof delta?.text === "string" && delta.type === "text_delta" ? delta.text : "";
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

/** Claude Code reports the turn's token count in its final `result` event, which
    already aggregates every API request the turn made. Assistant events carry a
    per-request `usage` and are only summed when the run ended without a result
    event -- an aborted turn, or a CLI version that omits it. */
export function extractClaudeUsage(output: unknown): TurnUsage | undefined {
  if (typeof output !== "string") return undefined;
  const events = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
  });
  const result = [...events].reverse().find((event) => event.type === "result" && isUsage(event.usage));
  if (result) {
    const usage = readUsage(result.usage);
    const cost = result.total_cost_usd;
    return { ...usage, ...(typeof cost === "number" ? { costUsd: cost } : {}) };
  }
  const requests = events.flatMap((event) => {
    const message = event.message as Record<string, unknown> | undefined;
    return isUsage(message?.usage) ? [readUsage(message?.usage)] : [];
  });
  if (!requests.length) return undefined;
  return requests.reduce((total, usage) => ({
    inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
    cacheReadInputTokens: total.cacheReadInputTokens + usage.cacheReadInputTokens,
    cacheCreationInputTokens: total.cacheCreationInputTokens + usage.cacheCreationInputTokens,
  }));
}

function isUsage(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const usage = value as Record<string, unknown>;
  return typeof usage.input_tokens === "number" || typeof usage.output_tokens === "number";
}

function readUsage(value: unknown): TurnUsage {
  const usage = (value ?? {}) as Record<string, unknown>;
  const count = (candidate: unknown): number => (typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0);
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheReadInputTokens: count(usage.cache_read_input_tokens),
    cacheCreationInputTokens: count(usage.cache_creation_input_tokens),
  };
}

/** Claude Code reports no plan limits in `--print`: the five-hour and weekly
    windows exist only in its interactive status-line contract, so ADE reports
    them as unknown instead of guessing. What it does report every turn is the
    token count, which is what the context window is holding. */
export function extractClaudePressure(event: unknown): ProviderPressure | undefined {
  if (!event || typeof event !== "object") return undefined;
  const node = event as Record<string, unknown>;
  const message = node.message as Record<string, unknown> | undefined;
  const usage = isUsage(node.usage) ? node.usage : isUsage(message?.usage) ? message?.usage : undefined;
  const limits = readClaudeLimits(node.rate_limits);
  if (!usage) return limits;
  const counts = readUsage(usage);
  const model = typeof message?.model === "string" ? message.model : claudeModelFromUsage(node.modelUsage);
  const windowTokens = model ? claudeContextWindow(model) : undefined;
  return {
    context: { usedTokens: counts.inputTokens + counts.cacheReadInputTokens + counts.cacheCreationInputTokens, ...(windowTokens ? { windowTokens } : {}) },
    ...limits,
  };
}

/** Published context windows for the aliases the model picker offers. An alias
    ADE cannot place reports its tokens without a percentage rather than a
    percentage of a window it invented. */
export function claudeContextWindow(model: string): number | undefined {
  const name = model.toLowerCase();
  if (name.includes("haiku")) return 200_000;
  if (["opus", "sonnet", "fable", "mythos"].some((family) => name.includes(family))) return 1_000_000;
  return undefined;
}

function claudeModelFromUsage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const [model] = Object.keys(value as Record<string, unknown>);
  return model;
}

/** Shape of the status-line contract, read defensively so a CLI that starts
    reporting it in `--print` is understood without another release of ADE. */
function readClaudeLimits(value: unknown): ProviderPressure | undefined {
  if (!value || typeof value !== "object") return undefined;
  const limits = value as Record<string, unknown>;
  const window = (candidate: unknown): UsageWindow | undefined => {
    if (!candidate || typeof candidate !== "object") return undefined;
    const entry = candidate as Record<string, unknown>;
    const used = entry.used_percentage ?? entry.used_percent;
    if (typeof used !== "number" || !Number.isFinite(used)) return undefined;
    const resetsAt = typeof entry.resets_at === "number" ? new Date(entry.resets_at * 1_000).toISOString() : undefined;
    return { usedPercent: used, ...(resetsAt ? { resetsAt } : {}) };
  };
  const session = window(limits.five_hour);
  const weekly = window(limits.seven_day);
  if (!session && !weekly) return undefined;
  return { ...(session ? { session } : {}), ...(weekly ? { weekly } : {}) };
}
