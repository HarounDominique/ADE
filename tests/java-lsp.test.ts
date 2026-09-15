import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { LspTransport, type JsonRpcMessage } from "../src/application/java-lsp/lsp-transport.js";

class FakeProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
}

function packet(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  return Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n${body.toString()}`);
}

test("LSP transport frames requests and resolves fragmented responses", async () => {
  const process = new FakeProcess();
  const transport = new LspTransport(process as never);
  const written: Buffer[] = [];
  process.stdin.on("data", (chunk) => written.push(Buffer.from(chunk)));
  const result = transport.request("initialize", { capabilities: {} });
  assert.match(Buffer.concat(written).toString(), /Content-Length:/);
  process.stdout.write(packet({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }).subarray(0, 10));
  process.stdout.write(packet({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }).subarray(10));
  assert.deepEqual(await result, { capabilities: {} });
});

test("LSP transport exposes server notifications without treating them as responses", () => {
  const process = new FakeProcess();
  const notifications: string[] = [];
  new LspTransport(process as never, (message: JsonRpcMessage) => notifications.push(message.method ?? ""));
  process.stdout.write(packet({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: {} }));
  assert.deepEqual(notifications, ["textDocument/publishDiagnostics"]);
});
