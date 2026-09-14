import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { executeHttpRequest } from "../src/adapters/http-request-executor.js";
import type { HttpEnvironment, HttpRequest } from "../src/domain/http-request.js";

/** Ephemeral echo server: captures what it actually received (server-side, independent of
    anything our library returns) into `lastReceived`, so tests can prove the real network path
    carried the real substituted value — then answers based on query controls (`status`,
    `delayMs`) and echoes the received url/headers back into response headers so redaction can be
    tested on the one HttpExecution field that could ever carry it: `responseHeaders`. */
type ReceivedRequest = { method: string; url: string; headers: Record<string, string>; body: string };

let server: Server;
let baseUrl: string;
let lastReceived: ReceivedRequest | null = null;

// A plain `lastReceived = null;` inline at each call site lets TypeScript's control-flow
// analysis narrow the variable's static type to the literal `null` for the rest of that
// function body (even across an intervening `await`), which then makes every later
// `lastReceived?.field` read a compile error ("does not exist on type 'never'") since the
// checker no longer considers the object-typed branch reachable. Resetting through a function
// call sidesteps that narrowing — the assignment is real at runtime, just not visible to the
// checker as a literal `= null` in the caller's scope.
function resetLastReceived(): void {
  lastReceived = null;
}

test.before(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers[key] = value;
      }
      lastReceived = { method: req.method ?? "", url: req.url ?? "", headers, body };

      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const status = Number(url.searchParams.get("status") ?? "200");
      const delayMs = Number(url.searchParams.get("delayMs") ?? "0");
      const echoedSecretHeader = req.headers["x-custom-secret"];

      const respond = () => {
        res.setHeader("content-type", "application/json");
        res.setHeader("x-echo-url", req.url ?? "");
        if (typeof echoedSecretHeader === "string") res.setHeader("x-echo-custom", echoedSecretHeader);
        res.writeHead(status);
        res.end(JSON.stringify({ ok: true, method: req.method, path: url.pathname, received: body }));
      };
      if (delayMs > 0) setTimeout(respond, delayMs);
      else respond();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const baseRequest = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
  id: "req-1",
  name: "Test request",
  method: "GET",
  url: `${baseUrl}/echo`,
  headers: [],
  params: [],
  auth: { type: "none" },
  body: { type: "none" },
  ...overrides,
});

const exec = (request: HttpRequest, environment?: HttpEnvironment) =>
  executeHttpRequest({ request, projectId: "project-1", ...(environment !== undefined ? { environment } : {}) });

test("a GET request executes against the real server and captures status, headers, size and duration", async () => {
  resetLastReceived();
  const execution = await exec(baseRequest());
  assert.equal(execution.status, 200);
  assert.equal(execution.requestId, "req-1");
  assert.equal(execution.projectId, "project-1");
  assert.equal(execution.taskId, undefined);
  assert.equal(execution.environmentId, undefined);
  assert.equal(typeof execution.id, "string");
  assert.ok(execution.id.length > 0);
  assert.equal(typeof execution.startedAt, "string");
  assert.ok(!Number.isNaN(Date.parse(execution.startedAt)));
  assert.ok(typeof execution.durationMs === "number" && execution.durationMs >= 0);
  assert.ok(execution.responseHeaders);
  assert.equal(execution.responseHeaders?.["content-type"], "application/json");
  assert.ok(typeof execution.responseSize === "number" && (execution.responseSize ?? 0) > 0);
  assert.equal(lastReceived?.method, "GET");
});

test("stamps taskId and environmentId onto the execution when provided", async () => {
  const environment: HttpEnvironment = { id: "env-1", name: "Local", variables: [] };
  const execution = await executeHttpRequest({
    request: baseRequest(),
    environment,
    projectId: "project-1",
    taskId: "task-1",
  });
  assert.equal(execution.taskId, "task-1");
  assert.equal(execution.environmentId, "env-1");
});

test("url and header variable substitution reaches the real request", async () => {
  const environment: HttpEnvironment = {
    id: "env-1",
    name: "Local",
    variables: [{ key: "path", value: "echo", secret: false }],
  };
  resetLastReceived();
  await exec(
    baseRequest({ url: `${baseUrl}/{{path}}`, headers: [{ key: "X-Trace", value: "{{path}}-trace", enabled: true }] }),
    environment,
  );
  assert.equal(lastReceived?.url.split("?")[0], "/echo");
  assert.equal(lastReceived?.headers["x-trace"], "echo-trace");
});

test("a disabled header is not sent", async () => {
  resetLastReceived();
  await exec(baseRequest({ headers: [{ key: "X-Off", value: "nope", enabled: false }] }));
  assert.equal(lastReceived?.headers["x-off"], undefined);
});

test("enabled query params are appended to the request", async () => {
  resetLastReceived();
  await exec(baseRequest({ params: [{ key: "verbose", value: "true", enabled: true }, { key: "off", value: "x", enabled: false }] }));
  const url = new URL(lastReceived?.url ?? "", "http://127.0.0.1");
  assert.equal(url.searchParams.get("verbose"), "true");
  assert.equal(url.searchParams.has("off"), false);
});

test("POST json body is sent raw with a json content-type", async () => {
  resetLastReceived();
  await exec(baseRequest({ method: "POST", body: { type: "json", content: '{"a":1}' } }));
  assert.equal(lastReceived?.body, '{"a":1}');
  assert.match(lastReceived?.headers["content-type"] ?? "", /json/);
});

test("POST text body is sent raw with a text content-type", async () => {
  resetLastReceived();
  await exec(baseRequest({ method: "POST", body: { type: "text", content: "plain text" } }));
  assert.equal(lastReceived?.body, "plain text");
  assert.match(lastReceived?.headers["content-type"] ?? "", /text/);
});

test("POST xml body is sent raw with an xml content-type", async () => {
  resetLastReceived();
  await exec(baseRequest({ method: "POST", body: { type: "xml", content: "<a>1</a>" } }));
  assert.equal(lastReceived?.body, "<a>1</a>");
  assert.match(lastReceived?.headers["content-type"] ?? "", /xml/);
});

test("POST form-urlencoded body sends only enabled fields, url-encoded", async () => {
  resetLastReceived();
  await exec(
    baseRequest({
      method: "POST",
      body: {
        type: "form-urlencoded",
        fields: [
          { key: "a", value: "1", enabled: true },
          { key: "b", value: "2", enabled: false },
        ],
      },
    }),
  );
  assert.match(lastReceived?.headers["content-type"] ?? "", /x-www-form-urlencoded/);
  const params = new URLSearchParams(lastReceived?.body ?? "");
  assert.equal(params.get("a"), "1");
  assert.equal(params.has("b"), false);
});

test("POST multipart body sends only enabled non-file fields", async () => {
  resetLastReceived();
  await exec(
    baseRequest({
      method: "POST",
      body: {
        type: "multipart",
        fields: [
          { key: "caption", value: "hi", isFile: false, enabled: true },
          { key: "skipped", value: "nope", isFile: false, enabled: false },
        ],
      },
    }),
  );
  assert.match(lastReceived?.headers["content-type"] ?? "", /multipart\/form-data/);
  assert.match(lastReceived?.body ?? "", /name="caption"/);
  assert.match(lastReceived?.body ?? "", /hi/);
  assert.doesNotMatch(lastReceived?.body ?? "", /skipped/);
});

test("basic auth sets the Authorization header via axios's own auth option", async () => {
  resetLastReceived();
  await exec(baseRequest({ auth: { type: "basic", username: "alice", password: "hunter2" } }));
  const expected = `Basic ${Buffer.from("alice:hunter2").toString("base64")}`;
  assert.equal(lastReceived?.headers["authorization"], expected);
});

test("bearer auth sets an Authorization: Bearer header", async () => {
  resetLastReceived();
  await exec(baseRequest({ auth: { type: "bearer", token: "abc.def" } }));
  assert.equal(lastReceived?.headers["authorization"], "Bearer abc.def");
});

test("apikey auth placed in header sends the configured header", async () => {
  resetLastReceived();
  await exec(baseRequest({ auth: { type: "apikey", key: "X-Api-Key", value: "k-1", placement: "header" } }));
  assert.equal(lastReceived?.headers["x-api-key"], "k-1");
});

test("apikey auth placed in query sends the configured query param", async () => {
  resetLastReceived();
  await exec(baseRequest({ auth: { type: "apikey", key: "api_key", value: "k-1", placement: "query" } }));
  const url = new URL(lastReceived?.url ?? "", "http://127.0.0.1");
  assert.equal(url.searchParams.get("api_key"), "k-1");
});

test("none auth sends no Authorization header", async () => {
  resetLastReceived();
  await exec(baseRequest({ auth: { type: "none" } }));
  assert.equal(lastReceived?.headers["authorization"], undefined);
});

test("a non-2xx HTTP response is a real status, not an execution error", async () => {
  const execution = await exec(baseRequest({ url: `${baseUrl}/echo?status=404` }));
  assert.equal(execution.status, 404);
});

test("a network failure (nothing listening) is captured as status \"error\", not a thrown rejection", async () => {
  const reserved = createServer();
  await new Promise<void>((resolve) => reserved.listen(0, "127.0.0.1", resolve));
  const address = reserved.address() as AddressInfo;
  await new Promise<void>((resolve) => reserved.close(() => resolve()));
  // Nothing is listening on this port anymore: connection should be refused.
  const execution = await exec(baseRequest({ url: `http://127.0.0.1:${address.port}/echo` }));
  assert.equal(execution.status, "error");
  assert.equal(execution.responseHeaders, undefined);
  assert.ok(typeof execution.durationMs === "number" && execution.durationMs >= 0);
});

test("no assertions leaves assertionResults undefined", async () => {
  const execution = await exec(baseRequest());
  assert.equal(execution.assertionResults, undefined);
});

test("status assertions: eq, neq, lt, lte, gt, gte", async () => {
  const execution = await exec(
    baseRequest({
      url: `${baseUrl}/echo?status=201`,
      assertions: [
        { target: "status", operator: "eq", expected: 201 },
        { target: "status", operator: "neq", expected: 200 },
        { target: "status", operator: "lt", expected: 300 },
        { target: "status", operator: "lte", expected: 201 },
        { target: "status", operator: "gt", expected: 200 },
        { target: "status", operator: "gte", expected: 201 },
      ],
    }),
  );
  assert.ok(execution.assertionResults);
  assert.deepEqual(execution.assertionResults?.map((r) => r.passed), [true, true, true, true, true, true]);
});

test("a failing status assertion is reported as not passed", async () => {
  const execution = await exec(
    baseRequest({ assertions: [{ target: "status", operator: "eq", expected: 999 }] }),
  );
  assert.deepEqual(execution.assertionResults?.map((r) => r.passed), [false]);
});

test("duration assertions: lt/lte/gt/gte against durationMs", async () => {
  const execution = await exec(
    baseRequest({
      assertions: [
        { target: "duration", operator: "gte", expected: 0 },
        { target: "duration", operator: "lt", expected: 60_000 },
      ],
    }),
  );
  assert.deepEqual(execution.assertionResults?.map((r) => r.passed), [true, true]);
});

test("header assertions: eq and contains against a response header via path", async () => {
  const execution = await exec(
    baseRequest({
      assertions: [
        { target: "header", path: "content-type", operator: "eq", expected: "application/json" },
        { target: "header", path: "content-type", operator: "contains", expected: "json" },
        { target: "header", path: "content-type", operator: "neq", expected: "text/plain" },
      ],
    }),
  );
  assert.deepEqual(execution.assertionResults?.map((r) => r.passed), [true, true, true]);
});

test("body assertions: dot-path into a parsed JSON response, eq and contains", async () => {
  const execution = await exec(
    baseRequest({
      assertions: [
        { target: "body", path: "ok", operator: "eq", expected: "true" },
        { target: "body", path: "path", operator: "contains", expected: "echo" },
        { target: "body", operator: "contains", expected: "ok" },
      ],
    }),
  );
  assert.deepEqual(execution.assertionResults?.map((r) => r.passed), [true, true, true]);
});

test("a secret variable used in both a header value and the URL is never returned in plaintext", async () => {
  const environment: HttpEnvironment = {
    id: "env-1",
    name: "Local",
    variables: [{ key: "apiToken", value: "s3cr3t-value", secret: true }],
  };
  resetLastReceived();
  const execution = await exec(
    baseRequest({
      url: `${baseUrl}/echo?token={{apiToken}}`,
      headers: [{ key: "X-Custom-Secret", value: "{{apiToken}}", enabled: true }],
    }),
    environment,
  );

  // The real server-side capture proves the actual secret was really sent over the wire.
  assert.match(lastReceived?.url ?? "", /s3cr3t-value/);
  assert.equal(lastReceived?.headers["x-custom-secret"], "s3cr3t-value");

  // But nothing this function returns may carry the secret in plaintext.
  const serialized = JSON.stringify(execution);
  assert.doesNotMatch(serialized, /s3cr3t-value/);
  assert.notEqual(execution.responseHeaders?.["x-echo-url"], undefined);
  assert.doesNotMatch(execution.responseHeaders?.["x-echo-url"] ?? "", /s3cr3t-value/);
  assert.doesNotMatch(execution.responseHeaders?.["x-echo-custom"] ?? "", /s3cr3t-value/);
});
