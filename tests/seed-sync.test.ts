import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("the vendored SEED tree is synchronized with the standalone repository", () => {
  const output = execFileSync(process.execPath, [join(process.cwd(), "scripts", "sync-seed-plugin.mjs"), "--check"], { encoding: "utf8" });
  assert.match(output, /SEED vendor check OK/);
});
