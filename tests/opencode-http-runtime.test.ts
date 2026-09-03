import test from "node:test";
import assert from "node:assert/strict";
import { OpenCodeHttpRuntime } from "../src/adapters/opencode-http-runtime.js";

test("OpenCode adapter maps health, session, prompt and diff endpoints", async () => {
  const calls: Array<{ url: string; method: string; directory?: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", ...(new Headers(init?.headers).get("x-opencode-directory") ? { directory: new Headers(init?.headers).get("x-opencode-directory")! } : {}) });
    if (url.endsWith("/global/health")) return json({ healthy: true, version: "test" });
    if (url.endsWith("/session")) return json({ id: "session-1" });
    if (url.endsWith("/prompt_async")) return new Response(null, { status: 204 });
    if (url.endsWith("/message")) return json({ info: { structured_output: { summary: "ok", findings: [] } } });
    if (url.endsWith("/session/session-1/diff")) return json([{ path: "README.md" }]);
    throw new Error(`Unexpected request: ${url}`);
  };

  const runtime = new OpenCodeHttpRuntime("http://test", fetcher);
  assert.deepEqual(await runtime.health(), { healthy: true, version: "test" });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  await runtime.prompt(session, { text: "Inspect" });
  assert.deepEqual(await runtime.promptAndWait(session, {
    text: "Review",
    format: { type: "json_schema", schema: {} },
  }), { info: { structured_output: { summary: "ok", findings: [] } } });
  assert.deepEqual(await runtime.diff(session), [{ path: "README.md" }]);
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "GET http://test/global/health",
    "POST http://test/session",
    "POST http://test/session/session-1/prompt_async",
    "POST http://test/session/session-1/message",
    "GET http://test/session/session-1/diff",
  ]);
  assert.equal(calls[1]?.directory, "/tmp/project");
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
