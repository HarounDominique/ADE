import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

test("the vendored SEED tree is valid and synchronized when the standalone source is available", () => {
  const projectRoot = process.cwd();
  const standaloneSeed = resolve(projectRoot, "..", "seed");
  const output = existsSync(standaloneSeed)
    ? execFileSync(process.execPath, [join(projectRoot, "scripts", "sync-seed-plugin.mjs"), "--check"], { encoding: "utf8" })
    : execFileSync(process.execPath, [join(projectRoot, "plugins", "seed", "scripts", "validate-plugin-parity.mjs")], { encoding: "utf8" });
  assert.match(output, existsSync(standaloneSeed) ? /SEED vendor check OK/ : /Plugin parity OK/);
});
