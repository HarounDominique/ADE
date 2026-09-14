import test from "node:test";
import assert from "node:assert/strict";
import {
  requestToBrunoItem,
  brunoItemToRequest,
  environmentToBrunoVars,
  brunoVarsToEnvironment,
  substituteVariables,
  type HttpRequest,
  type HttpEnvironment,
} from "../src/domain/http-request.js";

const baseRequest = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
  id: "req-1",
  name: "Get user",
  method: "GET",
  url: "{{baseUrl}}/users/{{id}}",
  headers: [{ key: "X-Trace", value: "abc", enabled: true }],
  params: [{ key: "verbose", value: "true", enabled: true }],
  auth: { type: "none" },
  body: { type: "none" },
  ...overrides,
});

test("a GET request with headers and params round-trips through the Bruno item shape", () => {
  const request = baseRequest();
  const item = requestToBrunoItem(request);
  const back = brunoItemToRequest(item, request.id);
  assert.deepEqual(back, request);
});

test("each auth variant round-trips: basic, bearer, apikey", () => {
  for (const auth of [
    { type: "basic", username: "alice", password: "hunter2" } as const,
    { type: "bearer", token: "abc.def" } as const,
    { type: "apikey", key: "X-Api-Key", value: "secret", placement: "header" } as const,
    { type: "apikey", key: "api_key", value: "secret", placement: "query" } as const,
  ]) {
    const request = baseRequest({ auth });
    const back = brunoItemToRequest(requestToBrunoItem(request), request.id);
    assert.deepEqual(back.auth, auth);
  }
});

test("each body variant round-trips: json, text, xml, form-urlencoded, multipart", () => {
  const bodies: HttpRequest["body"][] = [
    { type: "json", content: '{\n  "a": 1\n}' },
    { type: "text", content: "plain text" },
    { type: "xml", content: "<a>1</a>" },
    { type: "form-urlencoded", fields: [{ key: "a", value: "1", enabled: true }, { key: "b", value: "2", enabled: false }] },
    { type: "multipart", fields: [{ key: "file", value: "photo.png", isFile: true, enabled: true }, { key: "caption", value: "hi", isFile: false, enabled: true }] },
  ];
  for (const body of bodies) {
    const request = baseRequest({ body });
    const back = brunoItemToRequest(requestToBrunoItem(request), request.id);
    assert.deepEqual(back.body, body);
  }
});

test("a disabled header and a disabled param survive the round trip", () => {
  const request = baseRequest({
    headers: [{ key: "X-Off", value: "nope", enabled: false }],
    params: [{ key: "off", value: "nope", enabled: false }],
  });
  const back = brunoItemToRequest(requestToBrunoItem(request), request.id);
  assert.deepEqual(back.headers, request.headers);
  assert.deepEqual(back.params, request.params);
});

const baseEnvironment = (overrides: Partial<HttpEnvironment> = {}): HttpEnvironment => ({
  id: "env-1",
  name: "Local",
  variables: [{ key: "baseUrl", value: "http://localhost:3000", secret: false }],
  ...overrides,
});

test("a non-secret environment variable round-trips its value", () => {
  const environment = baseEnvironment();
  const back = brunoVarsToEnvironment(environmentToBrunoVars(environment), environment.id, environment.name);
  assert.deepEqual(back, environment);
});

test("a declared variable substitutes into the url", () => {
  const environment = baseEnvironment({ variables: [{ key: "baseUrl", value: "http://localhost:3000", secret: false }] });
  assert.equal(substituteVariables("{{baseUrl}}/users", environment), "http://localhost:3000/users");
});

test("substitution with no active environment leaves every token literal", () => {
  assert.equal(substituteVariables("{{baseUrl}}/users/{{id}}", undefined), "{{baseUrl}}/users/{{id}}");
});

test("a token with no matching variable in the active environment is left literal, not blanked", () => {
  const environment = baseEnvironment({ variables: [{ key: "baseUrl", value: "http://localhost:3000", secret: false }] });
  assert.equal(substituteVariables("{{baseUrl}}/users/{{id}}", environment), "http://localhost:3000/users/{{id}}");
});
