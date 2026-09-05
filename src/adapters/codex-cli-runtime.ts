import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { AgentPermission, AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt } from "../ports/agent-runtime.js";

const execFile = promisify(execFileCallback);
export const defaultCodexCommand = process.env.ADE_CODEX_COMMAND ?? "/Applications/ChatGPT.app/Contents/Resources/codex";

type CommandRunner = (command: string, args: string[], options: { cwd: string; maxBuffer: number }) => Promise<{ stdout: string }>;

const execute: CommandRunner = (command, args, options) => new Promise((resolve, reject) => {
  const child = execFileCallback(command, args, options, (error, stdout) => {
    if (error) reject(error);
    else resolve({ stdout: stdout.toString() });
  });
  // `codex exec` is non-interactive. An open stdin makes it wait for an
  // additional prompt instead of completing the JSONL response.
  child.stdin?.end();
});

export const executeCodexCommand = execute;

export class CodexCliRuntime implements AgentRuntimePort {
  constructor(private readonly command = defaultCodexCommand, private readonly runner: CommandRunner = execute) {}

  async health(): Promise<{ healthy: boolean; version?: string }> {
    try { const { stdout } = await this.runner(this.command, ["--version"], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }); return { healthy: true, version: stdout.trim() }; }
    catch { return { healthy: false }; }
  }

  async createSession(input: { directory: string; title?: string }): Promise<SessionHandle> {
    return { id: `codex-pending-${randomUUID()}`, directory: input.directory };
  }

  async prompt(session: SessionHandle, input: { text: string; model?: string; grantedPermissions?: readonly AgentPermission[] }): Promise<unknown> {
    return this.executePrompt(session, input.text, input.grantedPermissions, input.model);
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const stdout = await this.executePrompt(session, input.text, [], input.model);
    return { output: stdout.trim(), provider: "codex" };
  }

  async *events(): AsyncIterable<RuntimeEvent> { return; }
  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const { stdout } = await execFile("git", ["diff", "--numstat"], { cwd: session.directory });
    return stdout.split("\n").filter(Boolean).map((line) => { const [additions, deletions, path] = line.split("\t"); return { ...(path ? { path } : {}), additions: Number(additions), deletions: Number(deletions) }; });
  }
  async abort(): Promise<void> { /* one-shot CLI processes finish or fail atomically */ }

  private async executePrompt(session: SessionHandle, text: string, grantedPermissions: readonly AgentPermission[] = [], model?: string): Promise<string> {
    const isNew = session.id.startsWith("codex-pending-");
    const sandbox = grantedPermissions.some((permission) => ["write_code", "write_docs"].includes(permission)) ? "workspace-write" : "read-only";
    const args = [
      ...(grantedPermissions.includes("network") ? ["--search"] : []),
      ...(model ? ["--model", model] : []),
      "exec",
      "--sandbox",
      sandbox,
      ...(isNew ? ["--cd", session.directory, "--json", text] : ["resume", session.id, text]),
    ];
    const { stdout } = await this.runner(this.command, args, { cwd: session.directory, maxBuffer: 4 * 1024 * 1024 });
    if (isNew) {
      const realSessionId = extractCodexSessionId(stdout);
      if (!realSessionId) throw new Error("Codex completed without reporting a resumable session id");
      session.id = realSessionId;
    }
    return stdout;
  }
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
