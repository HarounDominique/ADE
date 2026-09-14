import { randomUUID } from "node:crypto";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import type {
  HttpAssertion,
  HttpBody,
  HttpEnvironment,
  HttpExecution,
  HttpRequest,
} from "../domain/http-request.js";
import { substituteVariables } from "../domain/http-request.js";

/** Runs an `HttpRequest` for real against the network, from the sidecar (never the webview —
    this module has no webview surface at all), and returns the `HttpExecution` record for it.
    A failed network call (refused connection, timeout, DNS failure) is captured as
    `status: "error"` rather than left to escape as a thrown rejection: the caller always gets a
    valid `HttpExecution` back. An HTTP response with a 4xx/5xx status is not a failure at this
    layer — `validateStatus` below accepts everything the server sends, so a real status code
    always wins over "error"; only a request that never got a response counts as one.

    The return type carries an additional `responseBody` beyond the persisted `HttpExecution`
    contract: `HttpExecution` (SPEC-http-client.md#request-and-collection-contract) deliberately
    excludes response body from what gets written to history/evidence, but the Phase 4b response
    panel still needs to show the real body once, right after sending — a live "here's what came
    back" read, not a persisted one. `responseBody` is additive at this boundary only: it is never
    written to `http_executions` (`AdeStore.saveHttpExecution` only reads the `HttpExecution`
    fields it knows about, per its own column list) and callers that only care about
    `HttpExecution` can keep treating this return value as one, since it's a strict superset. */
export type ExecuteHttpRequestInput = {
  request: HttpRequest;
  environment?: HttpEnvironment;
  projectId: string;
  taskId?: string;
};

export async function executeHttpRequest(input: ExecuteHttpRequestInput): Promise<HttpExecution & { responseBody?: unknown }> {
  const { request, environment, projectId, taskId } = input;

  const config: AxiosRequestConfig = {
    method: request.method,
    url: substituteVariables(request.url, environment),
    headers: resolveHeaders(request, environment),
    params: resolveParams(request, environment),
    validateStatus: () => true,
    ...(request.timeoutMs !== undefined ? { timeout: request.timeoutMs } : {}),
  };
  applyAuth(config, request, environment);
  applyBody(config, request.body, environment);

  const startedAt = new Date();
  const startedAtMs = Date.now();
  let status: number | "error";
  let responseHeaders: Record<string, string> | undefined;
  let responseSize: number | undefined;
  let responseBody: unknown;

  try {
    const response = await axios.request(config);
    status = response.status;
    responseHeaders = redactHeaders(normalizeHeaders(response.headers), environment);
    responseSize = computeResponseSize(response);
    responseBody = response.data;
  } catch {
    status = "error";
  }

  const durationMs = Date.now() - startedAtMs;

  const assertionResults =
    request.assertions && request.assertions.length > 0
      ? request.assertions.map((assertion) => ({
          assertion,
          passed: evaluateAssertion(assertion, { status, durationMs, headers: responseHeaders, body: responseBody }),
        }))
      : undefined;

  return {
    id: randomUUID(),
    requestId: request.id,
    projectId,
    ...(taskId !== undefined ? { taskId } : {}),
    ...(environment?.id !== undefined ? { environmentId: environment.id } : {}),
    startedAt: startedAt.toISOString(),
    durationMs,
    status,
    ...(responseHeaders !== undefined ? { responseHeaders } : {}),
    ...(responseSize !== undefined ? { responseSize } : {}),
    ...(assertionResults !== undefined ? { assertionResults } : {}),
    ...(responseBody !== undefined ? { responseBody: redactBody(responseBody, environment) } : {}),
  };
}

function resolveHeaders(request: HttpRequest, environment: HttpEnvironment | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of request.headers) {
    if (!header.enabled) continue;
    headers[substituteVariables(header.key, environment)] = substituteVariables(header.value, environment);
  }
  return headers;
}

function resolveParams(request: HttpRequest, environment: HttpEnvironment | undefined): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  for (const param of request.params) {
    if (!param.enabled) continue;
    params[substituteVariables(param.key, environment)] = substituteVariables(param.value, environment);
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function applyAuth(config: AxiosRequestConfig, request: HttpRequest, environment: HttpEnvironment | undefined): void {
  const auth = request.auth;
  switch (auth.type) {
    case "none":
      return;
    case "basic":
      config.auth = {
        username: substituteVariables(auth.username, environment),
        password: substituteVariables(auth.password, environment),
      };
      return;
    case "bearer": {
      const headers = config.headers as Record<string, string>;
      headers["Authorization"] = `Bearer ${substituteVariables(auth.token, environment)}`;
      return;
    }
    case "apikey": {
      const key = substituteVariables(auth.key, environment);
      const value = substituteVariables(auth.value, environment);
      if (auth.placement === "header") {
        const headers = config.headers as Record<string, string>;
        headers[key] = value;
      } else {
        const params = (config.params as Record<string, string> | undefined) ?? {};
        params[key] = value;
        config.params = params;
      }
      return;
    }
  }
}

// `value` fields on a body ("text" content, or a form/multipart field's value) are substituted;
// file-field byte content (`isFile: true`) is deferred — see the module-level note in the test's
// companion doc comment / the phase's ambiguity note: `HttpBody`'s multipart field carries only a
// string `value`, with no path-to-file-bytes contract, so uploading real file bytes is left to a
// later phase and a file field is simply omitted from the multipart body sent here.
function applyBody(config: AxiosRequestConfig, body: HttpBody, environment: HttpEnvironment | undefined): void {
  const headers = config.headers as Record<string, string>;
  switch (body.type) {
    case "none":
      return;
    case "json":
      headers["Content-Type"] ??= "application/json";
      config.data = substituteVariables(body.content, environment);
      return;
    case "text":
      headers["Content-Type"] ??= "text/plain";
      config.data = substituteVariables(body.content, environment);
      return;
    case "xml":
      headers["Content-Type"] ??= "application/xml";
      config.data = substituteVariables(body.content, environment);
      return;
    case "form-urlencoded": {
      headers["Content-Type"] ??= "application/x-www-form-urlencoded";
      const params = new URLSearchParams();
      for (const field of body.fields) {
        if (!field.enabled) continue;
        params.append(substituteVariables(field.key, environment), substituteVariables(field.value, environment));
      }
      config.data = params.toString();
      return;
    }
    case "multipart": {
      const form = new FormData();
      for (const field of body.fields) {
        if (!field.enabled || field.isFile) continue;
        form.append(substituteVariables(field.key, environment), substituteVariables(field.value, environment));
      }
      config.data = form;
      return;
    }
  }
}

function normalizeHeaders(headers: AxiosResponse["headers"]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return result;
}

/** Never returns a secret variable's plaintext value: scans every response header value (the
    only field on `HttpExecution` a server response could ever populate with something the
    request itself carried, e.g. an API that echoes a header or the request URL back) and
    replaces any occurrence of a `secret: true` variable's value with a fixed marker. */
function redactHeaders(headers: Record<string, string>, environment: HttpEnvironment | undefined): Record<string, string> {
  const secrets = (environment?.variables ?? []).filter((variable) => variable.secret && variable.value.length > 0);
  if (secrets.length === 0) return headers;
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = secrets.reduce((text, secret) => text.split(secret.value).join("[REDACTED]"), value);
  }
  return redacted;
}

/** Same guarantee as `redactHeaders`, extended to the response body: a secret substituted into the
    request (in the URL, a header, or the body itself) commonly comes back verbatim in an API's own
    response — this repo's own test server does exactly that, echoing the request body back — so
    the body is exactly as reachable a leak surface as headers are, and `HttpExecution`'s own
    `#boundaries` "Always redactar... en cualquier superficie de lectura" draws no line between
    them. Recurses through objects/arrays so a secret nested inside a JSON response is still caught,
    not just a top-level string body; a non-string, non-object leaf (number, boolean, null) can't
    contain a secret substring and is left as-is. */
function redactBody(body: unknown, environment: HttpEnvironment | undefined): unknown {
  const secrets = (environment?.variables ?? []).filter((variable) => variable.secret && variable.value.length > 0);
  if (secrets.length === 0) return body;
  const redactString = (text: string): string => secrets.reduce((current, secret) => current.split(secret.value).join("[REDACTED]"), text);
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return redactString(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry)]));
    }
    return value;
  };
  return walk(body);
}

function computeResponseSize(response: AxiosResponse): number {
  const contentLength = response.headers?.["content-length"];
  const parsed = contentLength !== undefined ? Number(contentLength) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  const data = response.data as unknown;
  if (typeof data === "string") return Buffer.byteLength(data, "utf8");
  if (Buffer.isBuffer(data)) return data.length;
  try {
    return Buffer.byteLength(JSON.stringify(data ?? ""), "utf8");
  } catch {
    return 0;
  }
}

type AssertionContext = {
  status: number | "error";
  durationMs: number;
  headers: Record<string, string> | undefined;
  body: unknown;
};

function evaluateAssertion(assertion: HttpAssertion, context: AssertionContext): boolean {
  const actual = extractActual(assertion, context);
  return compare(actual, assertion.operator, assertion.expected);
}

function extractActual(assertion: HttpAssertion, context: AssertionContext): unknown {
  switch (assertion.target) {
    case "status":
      return context.status;
    case "duration":
      return context.durationMs;
    case "header":
      return assertion.path ? context.headers?.[assertion.path.toLowerCase()] : undefined;
    case "body":
      return assertion.path ? getByPath(context.body, assertion.path) : context.body;
  }
}

/** A dot-path expression into a JSON-parsed response body — the minimal real reading of
    `HttpAssertion.path`'s "expresión para body" for this phase. A string body is parsed as JSON
    first (falling back to the raw string when it isn't JSON, so a plain-text body still supports
    the pathless `contains`/`eq` case); a path segment through a non-object yields `undefined`. */
function getByPath(body: unknown, path: string): unknown {
  let value: unknown = typeof body === "string" ? tryParseJson(body) : body;
  for (const segment of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function compare(actual: unknown, operator: HttpAssertion["operator"], expected: string | number): boolean {
  switch (operator) {
    case "eq":
      return stringify(actual) === stringify(expected);
    case "neq":
      return stringify(actual) !== stringify(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "contains":
      return stringify(actual).includes(stringify(expected));
  }
}

function stringify(value: unknown): string {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}
