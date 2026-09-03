import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { LocalProcess } from "../src/adapters/local-process.js";
import { ServiceManager } from "../src/application/local-runtime/service-manager.js";

test("service manager starts a healthy local service and stops it", async () => {
  const manager = new ServiceManager(new LocalProcess());
  const definition = { id: "service-healthy", command: "/bin/sh", args: ["-c", "sleep 10"], cwd: tmpdir(), healthcheck: { command: "/bin/sh", args: ["-c", "exit 0"] } };
  assert.equal(await manager.start(definition), "RUNNING");
  assert.equal(manager.status(definition.id), "RUNNING");
  assert.equal(await manager.stop(definition.id), "STOPPED");
});

test("service manager marks a failed healthcheck and cleans up", async () => {
  const manager = new ServiceManager(new LocalProcess());
  const definition = { id: "service-unhealthy", command: "/bin/sh", args: ["-c", "sleep 10"], cwd: tmpdir(), healthcheck: { command: "/bin/sh", args: ["-c", "exit 1"] } };
  assert.equal(await manager.start(definition), "FAILED");
  assert.equal(manager.status(definition.id), "FAILED");
});
