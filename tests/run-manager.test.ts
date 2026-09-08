import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunManager, RunPortConflictError } from "../src/application/local-runtime/run-manager.js";
import { resolveRunConfigurations } from "../src/application/local-runtime/run-config.js";
import { LocalProcess } from "../src/adapters/local-process.js";
import type { PortProbePort } from "../src/ports/port-probe.js";
import type { RunConfiguration } from "../src/domain/run-configuration.js";

const node = process.execPath;
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
const freePorts: PortProbePort = { async inUse() { return false; } };

const alive = (overrides: Partial<RunConfiguration> = {}): RunConfiguration => ({
  id: "client",
  label: "Client",
  kind: "command",
  command: node,
  args: ["-e", "process.stdout.write('client up'); setTimeout(() => {}, 10000);"],
  cwd: tmpdir(),
  ...overrides,
});

test("a configuration starts, reports its pid and stops on request", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([alive()]);

  const started = await manager.start(catalog, "client", "run");
  assert.equal(started.state, "RUNNING");
  assert.ok(started.pid && started.pid > 0);

  await settle();
  const stopped = await manager.stop(started.id);
  assert.equal(stopped.state, "STOPPED");
  assert.equal(stopped.stoppedByUser, true);
  assert.ok(stopped.endedAt);
});

test("output reaches the console while the process is alive, not only when it dies", async () => {
  const chunks: string[] = [];
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir(), onOutput: (chunk) => chunks.push(chunk.text) });
  const catalog = resolveRunConfigurations([alive()]);

  const started = await manager.start(catalog, "client", "run");
  await settle();
  assert.match(chunks.join(""), /client up/);
  await manager.stop(started.id);
});

test("an occupied port stops the run before anything is spawned", async () => {
  const taken: PortProbePort = { async inUse(port) { return port === 4200; } };
  const manager = new RunManager(new LocalProcess(), taken, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([alive({ ports: [{ name: "web", port: 4200, protocol: "http", bind: "loopback" }] })]);

  await assert.rejects(manager.start(catalog, "client", "run"), (error: unknown) => error instanceof RunPortConflictError && error.port === 4200);
  assert.deepEqual(manager.sessions(), []);
});

test("debug mode uses the declared debug arguments and refuses without them", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const debuggable = resolveRunConfigurations([alive({
    debug: { args: ["-e", "process.stdout.write('debug up'); setTimeout(() => {}, 10000);"], port: 9229, protocol: "inspector" },
  })]);
  const chunks: string[] = [];
  const withOutput = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir(), onOutput: (chunk) => chunks.push(chunk.text) });

  const started = await withOutput.start(debuggable, "client", "debug");
  await settle();
  assert.match(chunks.join(""), /debug up/);
  assert.ok(started.ports.some((port) => port.port === 9229));
  await withOutput.stop(started.id);

  await assert.rejects(manager.start(resolveRunConfigurations([alive()]), "client", "debug"), /declares no debug mode/);
});

test("a compound starts its members in order and stops them in reverse", async () => {
  const stopped: string[] = [];
  const processes = new LocalProcess();
  const recording = {
    start: processes.start.bind(processes),
    async stop(handle: Parameters<LocalProcess["stop"]>[0], timeoutMs?: number) {
      stopped.push(handle.id);
      return processes.stop(handle, timeoutMs);
    },
  };
  const manager = new RunManager(recording, freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([
    alive({ id: "api", label: "API" }),
    alive({ id: "client", label: "Client" }),
    { id: "stack", label: "Full stack", kind: "compound", members: ["api", "client"] },
  ]);

  const started = await manager.start(catalog, "stack", "run");
  assert.equal(started.state, "RUNNING");
  const members = manager.sessions().filter((session) => session.parentId === started.id);
  assert.deepEqual(members.map((session) => session.configurationId), ["api", "client"]);

  await settle();
  await manager.stop(started.id);
  assert.deepEqual(stopped.map((id) => id.replace(/-\d+$/, "")), ["run-client", "run-api"]);
  assert.ok(manager.sessions().every((session) => session.state === "STOPPED"));
});

test("a member that fails takes down the members already started", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([
    alive({ id: "api", label: "API" }),
    alive({
      id: "broken",
      label: "Broken",
      healthcheck: { type: "command", target: `${node} -e process.exit(1)`, timeoutMs: 300 },
    }),
    { id: "stack", label: "Full stack", kind: "compound", members: ["api", "broken"] },
  ]);

  const started = await manager.start(catalog, "stack", "run");
  assert.equal(started.state, "FAILED");
  assert.match(started.failure ?? "", /member broken did not start/);
  assert.ok(manager.sessions().every((session) => session.state !== "RUNNING"));
});

test("the same configuration cannot be started twice at once", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([alive()]);

  const started = await manager.start(catalog, "client", "run");
  await assert.rejects(manager.start(catalog, "client", "run"), /already running/);
  await manager.stop(started.id);
});

test("a process that exits after spawn becomes a failed run with its exit code", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([alive({ args: ["-e", "process.exit(7)"] })]);

  const started = await manager.start(catalog, "client", "run");
  await settle();
  const session = manager.session(started.id);
  assert.equal(session?.state, "FAILED");
  assert.equal(session?.exitCode, 7);
  assert.match(session?.failure ?? "", /code 7/);
});

test("a compound preserves the member failure that prevented startup", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([
    alive({ id: "broken", args: ["-e", "process.exit(9)"] }),
    { id: "stack", label: "Stack", kind: "compound", members: ["broken"] },
  ]);

  const started = await manager.start(catalog, "stack", "run");
  await settle();
  const session = manager.session(started.id);
  assert.equal(session?.state, "FAILED");
  assert.match(session?.failure ?? "", /member broken exited with code 9/);
});

test("a compound refuses members that declare the same port", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([
    alive({ id: "api", ports: [{ port: 8080, protocol: "tcp", bind: "loopback" }] }),
    alive({ id: "worker", ports: [{ port: 8080, protocol: "tcp", bind: "loopback" }] }),
    { id: "stack", label: "Stack", kind: "compound", members: ["api", "worker"] },
  ]);

  await assert.rejects(manager.start(catalog, "stack", "run"), /port 8080 is declared by both api and worker/);
  assert.deepEqual(manager.sessions(), []);
});

test("a missing command directory produces an actionable failed session", async () => {
  const manager = new RunManager(new LocalProcess(), freePorts, { projectRoot: tmpdir() });
  const missing = resolveRunConfigurations([alive({ cwd: join(tmpdir(), "ade-directory-that-does-not-exist") })]);

  const started = await manager.start(missing, "client", "run");
  assert.equal(started.state, "FAILED");
  assert.match(started.failure ?? "", /cwd does not exist/);
});

test("concurrent starts reserve a configuration before probing ports", async () => {
  let release!: () => void;
  const probe: PortProbePort = { inUse: async () => new Promise<boolean>((resolve) => { release = () => resolve(false); }) };
  const manager = new RunManager(new LocalProcess(), probe, { projectRoot: tmpdir() });
  const catalog = resolveRunConfigurations([alive({ ports: [{ port: 43127, protocol: "tcp", bind: "loopback" }] })]);
  const firstStart = manager.start(catalog, "client", "run");

  await new Promise<void>((resolve) => setImmediate(resolve));
  await assert.rejects(manager.start(catalog, "client", "run"), /already running or starting/);
  release();
  const started = await firstStart;
  await manager.stop(started.id);
});
