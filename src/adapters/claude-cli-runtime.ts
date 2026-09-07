import { execFile as execFileCallback, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { AgentPermission, AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt } from "../ports/agent-runtime.js";

const execFile = promisify(execFileCallback);
export const defaultClaudeCommand = process.env.ADE_CLAUDE_COMMAND ?? "claude";

type CommandRunner = (command: string, args: string[], options: { cwd: string; maxBuffer: number; shell?: boolean }) => Promise<{ stdout: string }>;

const execute: CommandRunner = (command, args, options) => new Promise((resolve, reject) => {
  const child = execFileCallback(command, args, { ...options, shell: windowsCommandNeedsShell(command) }, (error, stdout) => {
    if (error) reject(error);
    else resolve({ stdout: stdout.toString() });
  });
  child.stdin?.end();
});

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

  async prompt(session: SessionHandle, input: { text: string; model?: string; grantedPermissions?: readonly AgentPermission[] }): Promise<unknown> {
    return this.executePrompt(session, input.text, input.grantedPermissions, input.model);
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const stdout = await this.executePrompt(session, input.text, [], input.model, JSON.stringify(input.format.schema));
    return { output: extractClaudeText(stdout), provider: "claude" };
  }

  async *events(): AsyncIterable<RuntimeEvent> { return; }

  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const { stdout } = await execFile("git", ["diff", "--numstat"], { cwd: session.directory });
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
      "--output-format", "json",
      "--permission-mode", writable ? "acceptEdits" : "default",
      "--permission-prompts", "none",
      "--allowed-tools", allowedTools.join(","),
      ...(model ? ["--model", model] : []),
      ...(schema ? ["--json-schema", schema] : []),
      ...(isNew ? ["--session-id", sessionId] : ["--resume", session.id]),
      text,
    ];
    const { stdout } = await this.runPromptCommand(args, session.directory);
    if (isNew) session.id = extractClaudeSessionId(stdout) ?? sessionId;
    return stdout;
  }

  private runPromptCommand(args: string[], cwd: string): Promise<{ stdout: string }> {
    if (this.runner !== execute) return this.runner(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024 });
    return new Promise((resolve, reject) => {
      const child = execFileCallback(this.command, args, { cwd, maxBuffer: 4 * 1024 * 1024, shell: windowsCommandNeedsShell(this.command) }, (error, stdout) => {
        if (this.activeChild === child) this.activeChild = undefined;
        if (error) reject(error);
        else resolve({ stdout: stdout.toString() });
      });
      this.activeChild = child;
      child.stdin?.end();
    });
  }
}

function windowsCommandNeedsShell(command: string): boolean {
  return process.platform === "win32" && (!/\.[^\\/]+$/.test(command) || /\.(?:cmd|bat)$/i.test(command));
}

export function extractClaudeSessionId(json: string): string | undefined {
  try {
    const event = JSON.parse(json) as Record<string, unknown>;
    const candidate = event.session_id ?? event.sessionId;
    return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export function extractClaudeText(output: unknown): string {
  if (typeof output !== "string") return output ? JSON.stringify(output) : "";
  try {
    const event = JSON.parse(output) as Record<string, unknown>;
    const result = event.result;
    if (typeof result === "string" && result.trim()) return result.trim();
    const text = event.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {
    // Claude may emit a human-readable error alongside its JSON result.
  }
  return output.trim();
}
