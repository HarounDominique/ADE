import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRequestFile, writeRequestFile, readEnvironmentFile, writeEnvironmentFile } from "../src/adapters/bruno-collection-store.js";
import type { HttpRequest, HttpEnvironment } from "../src/domain/http-request.js";

const tempDir = () => mkdtemp(join(tmpdir(), "ade-http-"));

test("a request written to a .bru file reads back with method, url, headers, params, auth and body intact", async (t) => {
  const directory = await tempDir();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "get-user.bru");
  const request: HttpRequest = {
    id: "ignored-on-write",
    name: "Get user",
    method: "GET",
    url: "{{baseUrl}}/users/{{id}}",
    headers: [{ key: "X-Trace", value: "abc", enabled: true }],
    params: [{ key: "verbose", value: "true", enabled: true }],
    auth: { type: "bearer", token: "{{token}}" },
    body: { type: "json", content: '{\n  "a": 1\n}' },
  };

  await writeRequestFile(path, request);
  const roundTripped = await readRequestFile(path);

  assert.equal(roundTripped.id, "get-user");
  assert.equal(roundTripped.name, request.name);
  assert.equal(roundTripped.method, request.method);
  assert.equal(roundTripped.url, request.url);
  assert.deepEqual(roundTripped.headers, request.headers);
  assert.deepEqual(roundTripped.params, request.params);
  assert.deepEqual(roundTripped.auth, request.auth);
  assert.deepEqual(roundTripped.body, request.body);
});

test("a hand-written .bru fixture from outside Assay parses correctly (Bruno CLI/app compatibility)", async (t) => {
  const directory = await tempDir();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "create-post.bru");
  // Written by hand in Bruno's own v2 .bru grammar — not produced by writeRequestFile — to catch
  // a mapping that only survives round-tripping its own output.
  await writeFile(
    path,
    `meta {
  name: Create post
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/posts
  body: json
  auth: basic
}

params:query {
  dryRun: false
}

headers {
  Content-Type: application/json
  ~X-Debug: 1
}

auth:basic {
  username: admin
  password: {{adminPassword}}
}

body:json {
  {
    "title": "Hello",
    "published": true
  }
}
`,
    "utf8",
  );

  const request = await readRequestFile(path);

  assert.equal(request.id, "create-post");
  assert.equal(request.name, "Create post");
  assert.equal(request.method, "POST");
  assert.equal(request.url, "{{baseUrl}}/posts");
  assert.deepEqual(request.headers, [
    { key: "Content-Type", value: "application/json", enabled: true },
    { key: "X-Debug", value: "1", enabled: false },
  ]);
  assert.deepEqual(request.params, [{ key: "dryRun", value: "false", enabled: true }]);
  assert.deepEqual(request.auth, { type: "basic", username: "admin", password: "{{adminPassword}}" });
  assert.deepEqual(request.body, { type: "json", content: '{\n  "title": "Hello",\n  "published": true\n}' });
});

test("an environment's non-secret variable round-trips; a secret variable's name and flag survive but its plaintext value does not", async (t) => {
  const directory = await tempDir();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "Local.bru");
  const environment: HttpEnvironment = {
    id: "ignored-on-write",
    name: "ignored-on-write",
    variables: [
      { key: "baseUrl", value: "http://localhost:3000", secret: false },
      { key: "apiKey", value: "super-secret-value", secret: true },
    ],
  };

  await writeEnvironmentFile(path, environment);
  const content = await import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
  assert.ok(!content.includes("super-secret-value"), "a secret variable's value must never be written to the .bru file in plaintext");

  const roundTripped = await readEnvironmentFile(path);
  assert.equal(roundTripped.id, "Local");
  assert.equal(roundTripped.name, "Local");
  assert.deepEqual(roundTripped.variables[0], { key: "baseUrl", value: "http://localhost:3000", secret: false });
  assert.equal(roundTripped.variables[1]?.key, "apiKey");
  assert.equal(roundTripped.variables[1]?.secret, true);
  assert.equal(roundTripped.variables[1]?.value, "");
});
