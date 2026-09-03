import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { AgentRuntimePort, FileDiff, RuntimeEvent, SessionHandle, StructuredPrompt } from "../ports/agent-runtime.js";

const execFile = promisify(execFileCallback);

export class CodexCliRuntime implements AgentRuntimePort {
  constructor(private readonly command = "codex") {}

  async health(): Promise<{ healthy: boolean; version?: string }> {
    try { const { stdout } = await execFile(this.command, ["--version"]); return { healthy: true, version: stdout.trim() }; }
    catch { return { healthy: false }; }
  }

  async createSession(input: { directory: string; title?: string }): Promise<SessionHandle> {
    return { id: `codex-${Date.now()}`, directory: input.directory };
  }

  async prompt(session: SessionHandle, input: { text: string }): Promise<void> {
    await execFile(this.command, ["exec", "--cd", session.directory, input.text], { cwd: session.directory, maxBuffer: 4 * 1024 * 1024 });
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const { stdout } = await execFile(this.command, ["exec", "--cd", session.directory, input.text], { cwd: session.directory, maxBuffer: 4 * 1024 * 1024 });
    return { output: stdout.trim(), provider: "codex" };
  }

  async *events(): AsyncIterable<RuntimeEvent> { return; }
  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const { stdout } = await execFile("git", ["diff", "--numstat"], { cwd: session.directory });
    return stdout.split("\n").filter(Boolean).map((line) => { const [additions, deletions, path] = line.split("\t"); return { ...(path ? { path } : {}), additions: Number(additions), deletions: Number(deletions) }; });
  }
  async abort(): Promise<void> { /* one-shot CLI processes finish or fail atomically */ }
}
