import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { seedPluginSearchPath, resolveSeedPluginDir } from "../src/adapters/seed-plugin.js";

test("the workflow plugin ships inside Assay and is found without anything installed", () => {
  const dir = resolveSeedPluginDir();

  assert.ok(dir, `the vendored plugin should resolve; looked in ${seedPluginSearchPath().join(", ")}`);
  assert.ok(existsSync(join(dir!, ".claude-plugin", "plugin.json")), "the resolved directory is a plugin, not just a directory that exists");
  assert.ok(existsSync(join(dir!, "commands")), "its commands come with it");
  assert.ok(existsSync(join(dir!, "agents")), "so do its agents");
});

test("an explicit override wins, so a packaged app can say where it put the plugin", () => {
  const previous = process.env.ADE_SEED_PLUGIN_DIR;
  try {
    process.env.ADE_SEED_PLUGIN_DIR = "/definitely/not/here";
    assert.deepEqual(seedPluginSearchPath(), ["/definitely/not/here"], "an override replaces the search, it does not extend it");
    assert.equal(resolveSeedPluginDir(), undefined, "an override that is not a plugin resolves to nothing rather than silently falling back");
  } finally {
    if (previous === undefined) delete process.env.ADE_SEED_PLUGIN_DIR;
    else process.env.ADE_SEED_PLUGIN_DIR = previous;
  }
});

test("the search path is reportable, so a miss can be read instead of guessed at", () => {
  const previous = process.env.ADE_SEED_PLUGIN_DIR;
  delete process.env.ADE_SEED_PLUGIN_DIR;
  try {
    const candidates = seedPluginSearchPath();
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every((candidate) => candidate.endsWith("seed")), "every candidate names the plugin it is looking for");
  } finally {
    if (previous !== undefined) process.env.ADE_SEED_PLUGIN_DIR = previous;
  }
});
