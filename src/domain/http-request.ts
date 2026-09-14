/** Domain shapes for the `http-client` module, matching the closed contract in
    SPEC-http-client.md#request-and-collection-contract exactly. This file also carries the
    pure mapping between these domain shapes and the plain JSON object that
    `@usebruno/filestore`'s `parseRequest`/`stringifyRequest`/`parseEnvironment`/`stringifyEnvironment`
    consume and produce (Bruno's own internal item/environment model) — no I/O, no
    `@usebruno/filestore` import here; the adapter in `src/adapters/bruno-collection-store.ts`
    is the one that calls those functions and touches the filesystem. */

export type HttpAuth =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "apikey"; key: string; value: string; placement: "header" | "query" };

export type HttpBody =
  | { type: "none" }
  | { type: "json" | "text" | "xml"; content: string }
  | { type: "form-urlencoded"; fields: readonly { key: string; value: string; enabled: boolean }[] }
  | { type: "multipart"; fields: readonly { key: string; value: string; isFile: boolean; enabled: boolean }[] };

export type HttpAssertion = {
  target: "status" | "duration" | "header" | "body";
  path?: string;
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
  expected: string | number;
};

export type HttpRequest = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  url: string;
  headers: readonly { key: string; value: string; enabled: boolean }[];
  params: readonly { key: string; value: string; enabled: boolean }[];
  auth: HttpAuth;
  body: HttpBody;
  assertions?: readonly HttpAssertion[];
  timeoutMs?: number;
};

export type HttpEnvironment = {
  id: string;
  name: string;
  variables: readonly { key: string; value: string; secret: boolean }[];
};

/** One recorded run of an `HttpRequest`, produced by the execution engine in
    `src/adapters/http-request-executor.ts`. Deliberately carries no resolved URL, request
    headers, or request/response body: those are reconstructible from the (already-persisted)
    `HttpRequest` + `HttpEnvironment` pair via `substituteVariables`, so this type only needs to
    record what the response itself contributes — status, timing, response headers/size, and any
    `assertions` verdicts. */
export type HttpExecution = {
  id: string;
  requestId: string;
  projectId: string;
  taskId?: string;
  environmentId?: string;
  startedAt: string;
  durationMs: number;
  status: number | "error";
  responseHeaders?: Record<string, string>;
  responseSize?: number;
  assertionResults?: readonly { assertion: HttpAssertion; passed: boolean }[];
};

/** One node of a collection tree as `src/adapters/bruno-collection-store.ts`'s
    `listHttpCollectionTree` walks `.ade/http/`. `path` is always relative to the root the tree
    was listed from, forward-slash-joined regardless of platform, since the UI (Phase 4b) and the
    save RPCs both address a file by that relative path, not an absolute one. A `.bru` file whose
    immediate parent directory is named `environments` is an `HttpCollectionEnvironmentNode`
    rather than a request — Bruno's own convention keeps environment files in an `environments/`
    folder alongside (not inside) the request tree they apply to, and `@usebruno/filestore` itself
    exposes separate `parseRequest`/`parseEnvironment` functions rather than one that tells the two
    apart, so the directory convention is the only signal available to route a file to the right
    parser without opening and inspecting its content first. */
export type HttpCollectionNode = HttpCollectionFolderNode | HttpCollectionRequestNode | HttpCollectionEnvironmentNode;

export type HttpCollectionFolderNode = {
  type: "folder";
  name: string;
  path: string;
  children: readonly HttpCollectionNode[];
};

export type HttpCollectionRequestNode = {
  type: "request";
  id: string;
  name: string;
  method: HttpRequest["method"];
  path: string;
};

export type HttpCollectionEnvironmentNode = {
  type: "environment";
  id: string;
  name: string;
  path: string;
};

/** The plain object shape `@usebruno/filestore`'s `parseRequest`/`stringifyRequest` read and
    write for `{ format: 'bru' }`, restricted to the fields Phase 1 cares about. Bruno's own
    model carries a lot more (scripts, vars, oauth2, examples, …); we round-trip only what our
    domain `HttpRequest` needs and let the library default the rest. Bruno stores neither an id
    nor a stable identity for a request inside the file — a request's identity comes from its
    filename, so the adapter supplies `id` and the mapping below never sees or invents one. */
export type BrunoRequestItem = {
  type: "http-request";
  name: string;
  request: {
    method: string;
    url: string;
    headers: readonly { name: string; value: string; enabled: boolean }[];
    params: readonly { name: string; value: string; type: "query" | "path"; enabled: boolean }[];
    auth: BrunoAuth;
    body: BrunoBody;
  };
};

type BrunoAuth =
  | { mode: "none" }
  | { mode: "basic"; basic: { username: string; password: string } }
  | { mode: "bearer"; bearer: { token: string } }
  | { mode: "apikey"; apikey: { key: string; value: string; placement: string } };

type BrunoBody =
  | { mode: "none" }
  | { mode: "json" | "text" | "xml"; json?: string; text?: string; xml?: string }
  | { mode: "formUrlEncoded"; formUrlEncoded: readonly { name: string; value: string; enabled: boolean }[] }
  | { mode: "multipartForm"; multipartForm: readonly { name: string; value: string; type: "text" | "file"; enabled: boolean }[] };

/** Bruno's own `.bru` environment format has no field for a variable's own file identity either
    (name and id both come from the environment's filename) — the mapping below carries only
    `variables`. A secret variable's value is deliberately dropped on the way through Bruno's own
    format: `vars:secret [...]` lists secret variable names only, never their plaintext value —
    consistent with this module's own boundary of never writing a secret in plaintext. */
export type BrunoEnvironmentVars = {
  variables: readonly { name: string; value: string; secret: boolean; enabled: boolean }[];
};

export function requestToBrunoItem(request: HttpRequest): BrunoRequestItem {
  return {
    type: "http-request",
    name: request.name,
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers.map((header) => ({ name: header.key, value: header.value, enabled: header.enabled })),
      params: request.params.map((param) => ({ name: param.key, value: param.value, type: "query", enabled: param.enabled })),
      auth: authToBruno(request.auth),
      body: bodyToBruno(request.body),
    },
  };
}

export function brunoItemToRequest(item: BrunoRequestItem, id: string): HttpRequest {
  return {
    id,
    name: item.name,
    method: item.request.method as HttpRequest["method"],
    url: item.request.url,
    headers: item.request.headers.map((header) => ({ key: header.name, value: header.value, enabled: header.enabled })),
    // Bruno's own params block distinguishes query/path params; our domain contract models only
    // query-string substitution (`{{variable}}` inside the url covers path segments), so a
    // path-typed param on a foreign .bru file is intentionally left out rather than guessed at.
    params: item.request.params.filter((param) => param.type === "query").map((param) => ({ key: param.name, value: param.value, enabled: param.enabled })),
    auth: authFromBruno(item.request.auth),
    body: bodyFromBruno(item.request.body),
  };
}

function authToBruno(auth: HttpAuth): BrunoAuth {
  switch (auth.type) {
    case "none":
      return { mode: "none" };
    case "basic":
      return { mode: "basic", basic: { username: auth.username, password: auth.password } };
    case "bearer":
      return { mode: "bearer", bearer: { token: auth.token } };
    case "apikey":
      return { mode: "apikey", apikey: { key: auth.key, value: auth.value, placement: auth.placement } };
  }
}

function authFromBruno(auth: BrunoAuth): HttpAuth {
  switch (auth.mode) {
    case "none":
      return { type: "none" };
    case "basic":
      return { type: "basic", username: auth.basic.username, password: auth.basic.password };
    case "bearer":
      return { type: "bearer", token: auth.bearer.token };
    case "apikey":
      return {
        type: "apikey",
        key: auth.apikey.key,
        value: auth.apikey.value,
        placement: auth.apikey.placement === "query" ? "query" : "header",
      };
  }
}

function bodyToBruno(body: HttpBody): BrunoBody {
  switch (body.type) {
    case "none":
      return { mode: "none" };
    case "json":
      return { mode: "json", json: body.content };
    case "text":
      return { mode: "text", text: body.content };
    case "xml":
      return { mode: "xml", xml: body.content };
    case "form-urlencoded":
      return {
        mode: "formUrlEncoded",
        formUrlEncoded: body.fields.map((field) => ({ name: field.key, value: field.value, enabled: field.enabled })),
      };
    case "multipart":
      return {
        mode: "multipartForm",
        multipartForm: body.fields.map((field) => ({
          name: field.key,
          value: field.value,
          type: field.isFile ? "file" : "text",
          enabled: field.enabled,
        })),
      };
  }
}

function bodyFromBruno(body: BrunoBody): HttpBody {
  switch (body.mode) {
    case "none":
      return { type: "none" };
    case "json":
      return { type: "json", content: body.json ?? "" };
    case "text":
      return { type: "text", content: body.text ?? "" };
    case "xml":
      return { type: "xml", content: body.xml ?? "" };
    case "formUrlEncoded":
      return {
        type: "form-urlencoded",
        fields: body.formUrlEncoded.map((field) => ({ key: field.name, value: field.value, enabled: field.enabled })),
      };
    case "multipartForm":
      return {
        type: "multipart",
        fields: body.multipartForm.map((field) => ({ key: field.name, value: field.value, isFile: field.type === "file", enabled: field.enabled })),
      };
  }
}

/** Resolves `{{variable}}` tokens in a request field (typically `url`) against an environment.
    A token whose name isn't declared in the environment — including when there is no active
    environment at all (`environment` is `undefined`) — is left as its literal `{{name}}` rather
    than substituted with an empty string, so an unresolved reference stays visible instead of
    silently disappearing into the request Assay would send. */
export function substituteVariables(text: string, environment: HttpEnvironment | undefined): string {
  return text.replace(/\{\{(\w+)\}\}/g, (token, name: string) => {
    const variable = environment?.variables.find((candidate) => candidate.key === name);
    return variable ? variable.value : token;
  });
}

export function environmentToBrunoVars(environment: HttpEnvironment): BrunoEnvironmentVars {
  return {
    variables: environment.variables.map((variable) => ({ name: variable.key, value: variable.value, secret: variable.secret, enabled: true })),
  };
}

export function brunoVarsToEnvironment(vars: BrunoEnvironmentVars, id: string, name: string): HttpEnvironment {
  return {
    id,
    name,
    variables: vars.variables.map((variable) => ({ key: variable.name, value: variable.value, secret: variable.secret })),
  };
}
