import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { LocalProcess } from "../src/adapters/local-process.js";
import { ServiceManager } from "../src/application/local-runtime/service-manager.js";

// Node itself is the one interpreter guaranteed on every platform the suite runs on.
const node = process.execPath;

test("service manager starts a healthy local service and stops it", async () => {
  const manager = new ServiceManager(new LocalProcess());
  const definition = { id: "service-healthy", command: node, args: ["-e", "setTimeout(() => {}, 10000);"], cwd: tmpdir(), healthcheck: { command: node, args: ["-e", "process.exit(0);"] } };
  assert.equal(await manager.start(definition), "RUNNING");
  assert.equal(manager.status(definition.id), "RUNNING");
  assert.equal(await manager.stop(definition.id), "STOPPED");
});

test("service manager marks a failed healthcheck and cleans up", async () => {
  const manager = new ServiceManager(new LocalProcess());
  const definition = { id: "service-unhealthy", command: node, args: ["-e", "setTimeout(() => {}, 10000);"], cwd: tmpdir(), healthcheck: { command: node, args: ["-e", "process.exit(1);"] } };
  assert.equal(await manager.start(definition), "FAILED");
  assert.equal(manager.status(definition.id), "FAILED");
});
