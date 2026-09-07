import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalProcess, runtimeEnvironment } from "../src/adapters/local-process.js";

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

// The discoverable locations belong to the developer's machine, so the suite
// asserts the guarantees the lookup makes rather than a particular install.
test("the runtime environment only adds real runtime directories, and keeps the ones it was given", () => {
  const windows = process.platform === "win32";
  const separator = windows ? ";" : ":";
  const inherited = windows ? ["C:\\Windows\\system32"] : ["/usr/bin", "/bin"];
  const pathKey = windows ? "Path" : "PATH";
  const env = runtimeEnvironment({ [pathKey]: inherited.join(separator), JAVA_HOME: "" });

  const entries = (env[pathKey] ?? "").split(separator).filter(Boolean);
  assert.deepEqual(entries.slice(-inherited.length), inherited, "an inherited PATH is never dropped");
  assert.equal(new Set(entries).size, entries.length, "no directory is added twice");
  const executables = windows ? ["npm.cmd", "java.exe"] : ["npm", "java"];
  for (const added of entries.slice(0, entries.length - inherited.length)) {
    const runtime = executables.find((executable) => existsSync(join(added, executable)));
    assert.ok(runtime, `${added} was added without any of ${executables.join(" or ")} in it`);
  }
  if (env.JAVA_HOME) {
    assert.ok(existsSync(join(env.JAVA_HOME, "bin", windows ? "java.exe" : "java")), "JAVA_HOME has no java");
  }
});

test("the runtime environment is idempotent over an already resolved PATH", () => {
  const once = runtimeEnvironment(undefined);
  const twice = runtimeEnvironment(once);
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  assert.equal(twice[pathKey], once[pathKey]);
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
