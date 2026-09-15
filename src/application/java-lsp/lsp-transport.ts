import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type JsonRpcId = number | string;
export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** Small, dependency-free LSP transport. LSP is framed JSON-RPC, not JSONL:
    keeping the parser here prevents editor code from knowing anything about
    child-process streams or partial packets. */
export class LspTransport {
  private buffer = Buffer.alloc(0);
  private sequence = 0;
  private readonly pending = new Map<JsonRpcId, Pending>();
  private readonly onNotification: (message: JsonRpcMessage) => void;

  constructor(private readonly process: Pick<ChildProcessWithoutNullStreams, "stdin" | "stdout" | "stderr" | "once">, onNotification: (message: JsonRpcMessage) => void = () => {}) {
    this.onNotification = onNotification;
    process.stdout.on("data", (chunk: Buffer | string) => this.accept(chunk));
    process.once("error", (error) => this.failAll(error instanceof Error ? error : new Error(String(error))));
    process.once("close", (code, signal) => this.failAll(new Error(`Language server closed (${signal ?? code ?? "unknown"})`)));
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.sequence;
    const message: JsonRpcMessage = { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write(message);
    });
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  cancel(id: JsonRpcId): void {
    this.notify("$/cancelRequest", { id });
  }

  rejectPending(reason = "Language server stopped"): void {
    this.failAll(new Error(reason));
  }

  private write(message: JsonRpcMessage): void {
    const body = Buffer.from(JSON.stringify(message));
    this.process.stdin.write(`Content-Length: ${body.byteLength}\r\n\r\n`);
    this.process.stdin.write(body);
  }

  private accept(chunk: Buffer | string): void {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = /^Content-Length:\s*(\d+)$/im.exec(header);
      if (!match) throw new Error("Invalid LSP Content-Length header");
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + length);
      this.acceptMessage(JSON.parse(body) as JsonRpcMessage);
    }
  }

  private acceptMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    if (message.method) this.onNotification(message);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
