import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { LocalProcess } from "../src/adapters/local-process.js";

test("LocalProcess starts, captures output and stops a process", async () => {
  const processPort = new LocalProcess();
  const handle = await processPort.start({
    id: "process-test",
    command: "/bin/sh",
    args: ["-c", "printf ready; sleep 10"],
    cwd: tmpdir(),
  });

  assert.equal(handle.state, "RUNNING");
  await new Promise((resolve) => setTimeout(resolve, 50));
  const evidence = await processPort.stop(handle);
  assert.equal(evidence.state, "STOPPED");
  assert.match(evidence.stdout, /ready/);
});

test("LocalProcess reports an exit without leaving a handle", async () => {
  const processPort = new LocalProcess();
  const handle = await processPort.start({
    id: "process-exit",
    command: "/bin/sh",
    args: ["-c", "printf done"],
    cwd: tmpdir(),
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  const evidence = await processPort.stop(handle);
  assert.equal(evidence.state, "STOPPED");
  assert.match(evidence.stdout, /done/);
});
