import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalProcess, runtimeEnvironment, windowsJavaRoots, windowsNodeDirectories } from "../src/adapters/local-process.js";

const localProcessSource = readFileSync(new URL("../src/adapters/local-process.ts", import.meta.url), "utf8");
const safeCommandSource = readFileSync(new URL("../src/adapters/safe-command.ts", import.meta.url), "utf8");

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

test("LocalProcess preserves argv while supporting Windows command shims", () => {
  const start = localProcessSource.slice(localProcessSource.indexOf("async start"), localProcessSource.indexOf("async stop"));
  assert.match(start, /crossSpawn\(definition\.command, \[\.\.\.\(definition\.args \?\? \[\]\)\]/);
  assert.match(safeCommandSource, /cross-spawn/);
  assert.match(safeCommandSource, /structured/);
  assert.doesNotMatch(start, /shell:\s*true/);
  assert.doesNotMatch(localProcessSource, /windowsCommandNeedsShell/);
});

// Windows discovery is pure given an environment block, so it is testable from
// any machine -- which matters, because the suite that would catch it in place
// only ever runs on the platform it is running on.
const windowsEnv = {
  ProgramFiles: "C:\\Program Files",
  "ProgramFiles(x86)": "C:\\Program Files (x86)",
  ProgramData: "C:\\ProgramData",
  USERPROFILE: "C:\\Users\\dev",
} satisfies NodeJS.ProcessEnv;

test("Windows looks for Node where Windows actually installs it", () => {
  const directories = windowsNodeDirectories(windowsEnv);
  for (const expected of [
    "C:\\Program Files\\nodejs",
    "C:\\Program Files (x86)\\nodejs",
    "C:\\ProgramData\\chocolatey\\bin",
    "C:\\Users\\dev\\scoop\\shims",
    "C:\\Users\\dev\\.volta\\bin",
  ]) {
    assert.ok(directories.includes(expected), `${expected} is not looked for`);
  }
  // Entries are prepended, so a version manager has to come after the
  // machine-wide install to end up ahead of it on PATH.
  assert.ok(
    directories.indexOf("C:\\Users\\dev\\.volta\\bin") > directories.indexOf("C:\\Program Files\\nodejs"),
    "a version manager must outrank a machine-wide install",
  );
});

test("Windows looks for a JDK under every vendor that ships one", () => {
  const roots = windowsJavaRoots(windowsEnv);
  // No vendor owns Windows, so naming only one is naming the wrong one on most
  // machines. These are the directories their installers create.
  for (const vendor of ["Microsoft", "Eclipse Adoptium", "Amazon Corretto", "Zulu", "Java"]) {
    assert.ok(roots.includes(`C:\\Program Files\\${vendor}`), `${vendor} is not looked for`);
  }
  assert.ok(roots.some((root) => root.startsWith("C:\\Program Files (x86)")), "the 32-bit root is not looked for");
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
