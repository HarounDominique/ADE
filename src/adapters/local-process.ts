import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  ProcessDefinition,
  ProcessEvidence,
  ProcessHandle,
  ProcessPort,
} from "../ports/process.js";

export class LocalProcess implements ProcessPort {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly output = new Map<string, { stdout: string; stderr: string }>();

  async start(definition: ProcessDefinition): Promise<ProcessHandle> {
    const child = spawn(definition.command, [...(definition.args ?? [])], {
      cwd: definition.cwd,
      env: definition.env ? { ...process.env, ...definition.env } : process.env,
      stdio: "pipe",
      shell: false,
      detached: true,
    });
    const output = { stdout: "", stderr: "" };
    child.stdout.on("data", (chunk: Buffer) => { output.stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { output.stderr += chunk.toString(); });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
    const id = definition.id;
    this.processes.set(id, child);
    this.output.set(id, output);
    child.once("close", () => {
      this.processes.delete(id);
    });
    return { id, pid: child.pid ?? -1, state: "RUNNING" };
  }

  async stop(handle: ProcessHandle, timeoutMs = 2_000): Promise<ProcessEvidence> {
    const child = this.processes.get(handle.id);
    const output = this.output.get(handle.id) ?? { stdout: "", stderr: "" };
    if (!child) return { id: handle.id, state: "STOPPED", exitCode: null, signal: null, ...output };
    const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      const timer = setTimeout(() => {
        killGroup(child, "SIGKILL");
      }, timeoutMs);
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        setTimeout(() => resolve({ exitCode, signal }), 10);
      });
      killGroup(child, "SIGTERM");
    });
    this.output.delete(handle.id);
    return { id: handle.id, state: "STOPPED", ...result, ...output };
  }
}

function killGroup(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
