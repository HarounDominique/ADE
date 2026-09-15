import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { LspTransport, type JsonRpcMessage } from "./lsp-transport.js";

export type JavaLspStatus = "stopped" | "starting" | "ready" | "unavailable" | "failed";
export type JavaLspSnapshot = { projectId: string; status: JavaLspStatus; message: string | null };
type Session = { projectId: string; root: string; child: ChildProcessWithoutNullStreams; transport: LspTransport; status: JavaLspStatus; message: string | null };

function inside(root: string, file: string): boolean {
  const rel = relative(root, resolve(file));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** Owns one local JDTLS process per active Project. The public methods are
    deliberately language-server-shaped so a future Kotlin/TypeScript adapter
    can reuse the sidecar seam without exposing child processes to the UI. */
export class JavaLspManager {
  private readonly sessions = new Map<string, Session>();

  async start(projectId: string, root: string, command: string, args: readonly string[] = [], onNotification: (message: JsonRpcMessage) => void = () => {}): Promise<JavaLspSnapshot> {
    await this.stop(projectId);
    const normalizedRoot = resolve(root);
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(command, [...args], { cwd: normalizedRoot, stdio: "pipe", windowsHide: true });
    } catch (error) {
      return { projectId, status: "unavailable", message: error instanceof Error ? error.message : String(error) };
    }
    const session: Session = { projectId, root: normalizedRoot, child, transport: undefined as never, status: "starting", message: null };
    session.transport = new LspTransport(child, onNotification);
    this.sessions.set(projectId, session);
    child.stderr.on("data", () => { /* JDTLS logs are intentionally not mixed into sidecar stdout. */ });
    try {
      await session.transport.request("initialize", { processId: process.pid, rootUri: `file://${normalizedRoot}`, capabilities: { textDocument: { completion: { completionItem: { snippetSupport: false } }, hover: {}, definition: {} }, workspace: {} } });
      session.transport.notify("initialized", {});
      session.status = "ready";
      return this.readSnapshot(session);
    } catch (error) {
      session.status = "failed";
      session.message = error instanceof Error ? error.message : String(error);
      await this.stop(projectId);
      return { projectId, status: "failed", message: session.message };
    }
  }

  async stop(projectId: string): Promise<JavaLspSnapshot> {
    const session = this.sessions.get(projectId);
    if (!session) return { projectId, status: "stopped", message: null };
    this.sessions.delete(projectId);
    try {
      await Promise.race([
        session.transport.request("shutdown"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Language server shutdown timed out")), 1_000)),
      ]);
    } catch { /* process may already be gone or not answer shutdown */ }
    session.transport.notify("exit");
    session.transport.rejectPending();
    if (!session.child.killed) session.child.kill();
    return { projectId, status: "stopped", message: null };
  }

  async stopAll(): Promise<void> {
    for (const projectId of [...this.sessions.keys()]) await this.stop(projectId);
  }

  snapshot(projectId: string): JavaLspSnapshot {
    const session = this.sessions.get(projectId);
    return session ? this.readSnapshot(session) : { projectId, status: "stopped", message: null };
  }

  async open(projectId: string, file: string, text: string, languageId = "java"): Promise<void> {
    const session = this.requireReady(projectId, file);
    session.transport.notify("textDocument/didOpen", { textDocument: { uri: this.uri(file), languageId, version: 1, text } });
  }

  async change(projectId: string, file: string, text: string, version: number): Promise<void> {
    const session = this.requireReady(projectId, file);
    session.transport.notify("textDocument/didChange", { textDocument: { uri: this.uri(file), version }, contentChanges: [{ text }] });
  }

  async close(projectId: string, file: string): Promise<void> {
    const session = this.requireReady(projectId, file);
    session.transport.notify("textDocument/didClose", { textDocument: { uri: this.uri(file) } });
  }

  request(projectId: string, method: string, params: Record<string, unknown>, file: string): Promise<unknown> {
    const session = this.requireReady(projectId, file);
    return session.transport.request(method, params);
  }

  private requireReady(projectId: string, file: string): Session {
    const session = this.sessions.get(projectId);
    if (!session || session.status !== "ready") throw new Error(`Java language server is ${session?.status ?? "stopped"}`);
    if (!inside(session.root, file)) throw new Error("Java document must be inside the active Project");
    return session;
  }

  private uri(file: string): string { return `file://${resolve(file).split(sep).join("/")}`; }
  private readSnapshot(session: Session): JavaLspSnapshot { return { projectId: session.projectId, status: session.status, message: session.message }; }
}
