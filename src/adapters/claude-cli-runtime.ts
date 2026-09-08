import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentPermission, AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt } from "../ports/agent-runtime.js";
import { executeGit } from "./git-command.js";
import { startSafeCommand } from "./safe-command.js";

export const defaultClaudeCommand = process.env.ADE_CLAUDE_COMMAND ?? "claude";

type CommandRunner = (command: string, args: string[], options: { cwd: string; maxBuffer: number; shell?: boolean; onStdout?: (text: string) => void }) => Promise<{ stdout: string }>;

const execute: CommandRunner = (command, args, options) => startSafeCommand(command, args, options).completion;

export const executeClaudeCommand = execute;

export class ClaudeCliRuntime implements AgentRuntimePort {
  private activeChild: ChildProcess | undefined;

  constructor(private readonly command = defaultClaudeCommand, private readonly runner: CommandRunner = execute) {}

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

  private runPromptCommand(args: string[], cwd: string, onEvent?: (event: RuntimeEvent) => void): Promise<{ stdout: string }> {
    const jsonl = createJsonlEventEmitter((event) => onEvent?.({ type: "claude.event", payload: event }));
    if (this.runner !== execute) {
      return this.runner(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push }).finally(jsonl.flush);
    }
    const command = startSafeCommand(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, onStdout: jsonl.push });
    this.activeChild = command.child;
    return command.completion.finally(() => {
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
