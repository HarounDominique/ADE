import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { LocalProcess } from "../src/adapters/local-process.js";

// Node itself is the one interpreter guaranteed on every platform the suite runs on.
const node = process.execPath;
// A cold Node process needs longer to produce output than a shell builtin did.
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

test("LocalProcess starts, captures output and stops a process", async () => {
  const processPort = new LocalProcess();
  const handle = await processPort.start({
    id: "process-test",
    command: node,
    args: ["-e", "process.stdout.write('ready'); setTimeout(() => {}, 10000);"],
    cwd: tmpdir(),
  });

  assert.equal(handle.state, "RUNNING");
  await settle();
  const evidence = await processPort.stop(handle);
  assert.equal(evidence.state, "STOPPED");
  assert.match(evidence.stdout, /ready/);
});

test("LocalProcess reports an exit without leaving a handle", async () => {
  const processPort = new LocalProcess();
  const handle = await processPort.start({
    id: "process-exit",
    command: node,
    args: ["-e", "process.stdout.write('done');"],
    cwd: tmpdir(),
  });

  await settle();
  const evidence = await processPort.stop(handle);
  assert.equal(evidence.state, "STOPPED");
  assert.match(evidence.stdout, /done/);
});
