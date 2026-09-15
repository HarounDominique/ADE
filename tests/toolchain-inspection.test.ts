import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectProjectToolchains, probe } from "../src/application/local-runtime/toolchain-inspection.js";

test("toolchain inspection reports the entry points implied by Project manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-toolchains-"));
  await writeFile(join(root, "package.json"), "{}", "utf8");
  await writeFile(join(root, "pyproject.toml"), "[build-system]\n", "utf8");
  await mkdir(join(root, "node_modules", "ignored"), { recursive: true });
  await writeFile(join(root, "node_modules", "ignored", "package.json"), "{}", "utf8");

  const statuses = await inspectProjectToolchains(root);
  assert.deepEqual(statuses.map((status) => status.id), ["node", "python"]);
  assert.equal(statuses[0]?.command, "npm");
  assert.equal(statuses[0]?.source, "package.json");
  assert.equal(statuses[0]?.available, true);
  assert.match(statuses[0]?.version ?? "", /\d+\.\d+/);
  assert.equal(statuses[1]?.command, "python");
  assert.equal(statuses[1]?.source, "pyproject.toml");
});

test("toolchain inspection reports nothing for a Project with no recognized manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-toolchains-empty-"));
  await writeFile(join(root, "README.md"), "# empty project\n", "utf8");

  const statuses = await inspectProjectToolchains(root);

  assert.deepEqual(statuses, []);
});

test("toolchain version prefers stdout when Windows emits a warning on stderr", async () => {
  const status = await probe(process.execPath, "Node/npm", process.execPath, [
    "-e",
    "process.stderr.write('npm warn Unknown env config msbuild-path\\n'); process.stdout.write('10.9.2\\n');",
  ], "package.json", process.cwd(), process.env);

  assert.equal(status.available, true);
  assert.equal(status.version, "10.9.2");
});
