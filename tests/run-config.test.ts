import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RunConfigurationError,
  declaredPortsByName,
  loadRunConfigurations,
  resolveRunConfigurations,
  substituteRunTokens,
} from "../src/application/local-runtime/run-config.js";
import type { RunConfiguration } from "../src/domain/run-configuration.js";
import type { ServiceDefinition } from "../src/application/local-runtime/service-manager.js";

const api: ServiceDefinition = { id: "api", command: "node", args: ["server.js"], cwd: "/tmp/project/server", env: { PORT: "8080" }, shutdownTimeoutMs: 4_000 };

const command = (overrides: Partial<RunConfiguration> = {}): RunConfiguration => ({
  id: "client",
  label: "Client",
  kind: "command",
  command: "npm",
  args: ["run", "start"],
  cwd: "/tmp/project/client",
  ...overrides,
});

test("a service configuration inherits the declared command instead of restating it", () => {
  const [resolved] = resolveRunConfigurations([{ id: "api-run", label: "API", kind: "service", service: "api", env: { LOG_LEVEL: "debug" } }], [api]);
  assert.equal(resolved?.command, "node");
  assert.deepEqual(resolved?.args, ["server.js"]);
  assert.equal(resolved?.cwd, "/tmp/project/server");
  assert.deepEqual(resolved?.env, { PORT: "8080", LOG_LEVEL: "debug" });
  assert.equal(resolved?.shutdownTimeoutMs, 4_000);
});

test("restating a service's command is a validation error, not a convenience", () => {
  assert.throws(
    () => resolveRunConfigurations([{ id: "api-run", label: "API", kind: "service", service: "api", command: "node" }], [api]),
    (error: unknown) => error instanceof RunConfigurationError && error.field === "service",
  );
});

test("a service reference that names nothing fails in validation", () => {
  assert.throws(
    () => resolveRunConfigurations([{ id: "api-run", label: "API", kind: "service", service: "absent" }], [api]),
    /no service declared with id absent/,
  );
});

test("compound members are resolved and cycles are refused", () => {
  const catalog: RunConfiguration[] = [
    command(),
    { id: "stack", label: "Full stack", kind: "compound", members: ["client"] },
  ];
  assert.equal(resolveRunConfigurations(catalog).length, 2);

  assert.throws(
    () => resolveRunConfigurations([
      { id: "a", label: "A", kind: "compound", members: ["b"] },
      { id: "b", label: "B", kind: "compound", members: ["a"] },
    ]),
    /members form a cycle/,
  );

  assert.throws(() => resolveRunConfigurations([{ id: "stack", label: "Stack", kind: "compound", members: ["absent"] }]), /no configuration declared with id absent/);
});

test("configurations are rejected field by field", () => {
  assert.throws(() => resolveRunConfigurations([command({ label: "" })]), (error: unknown) => error instanceof RunConfigurationError && error.field === "label");
  assert.throws(() => resolveRunConfigurations([{ id: "client", label: "Client", kind: "command", cwd: "/tmp" }]), (error: unknown) => error instanceof RunConfigurationError && error.field === "command");
  assert.throws(() => resolveRunConfigurations([{ id: "client", label: "Client", kind: "command", command: "npm" }]), (error: unknown) => error instanceof RunConfigurationError && error.field === "cwd");
  assert.throws(() => resolveRunConfigurations([command(), command()]), /duplicate configuration id/);
  assert.throws(() => resolveRunConfigurations([command({ ports: [{ port: 70_000, protocol: "http", bind: "loopback" }] })]), /port out of range/);
  assert.throws(() => resolveRunConfigurations([command({ env: { API_TOKEN: "abc" } })]), /secret-like environment key/);
  assert.throws(() => resolveRunConfigurations([command({ debug: { args: [], port: 9229, protocol: "inspector" } })]), (error: unknown) => error instanceof RunConfigurationError && error.field === "debug.args");
});

test("tokens resolve the project root and a sibling's declared port", () => {
  const catalog = resolveRunConfigurations([command({ ports: [{ name: "web", port: 4200, protocol: "http", bind: "loopback" }] })]);
  const context = { projectRoot: "/tmp/project", ports: declaredPortsByName(catalog) };
  assert.equal(substituteRunTokens("${projectRoot}/client", context), "/tmp/project/client");
  assert.equal(substituteRunTokens("http://localhost:${port:web}/api", context), "http://localhost:4200/api");
  assert.equal(substituteRunTokens("${port:absent}", context), "${port:absent}");
});

test("run configurations load from .ade/run.json", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-run-"));
  const path = join(directory, "run.json");
  await writeFile(path, JSON.stringify({ configurations: [command()] }), "utf8");
  const catalog = await loadRunConfigurations(path);
  assert.equal(catalog[0]?.label, "Client");

  await writeFile(path, JSON.stringify({ runs: [] }), "utf8");
  await assert.rejects(loadRunConfigurations(path), /must contain a configurations array/);
});
