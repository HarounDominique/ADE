import test from "node:test";
import assert from "node:assert/strict";
import { inspectProviders } from "../src/application/agent-providers/provider-registry.js";

test("provider registry reports unavailable providers without credentials", async () => {
  const providers = await inspectProviders({ opencodeUrl: "http://127.0.0.1:1", codexCommand: "command-that-does-not-exist", claudeCommand: "command-that-does-not-exist" });
  assert.deepEqual(providers.map((provider) => provider.id), ["opencode", "codex", "claude"]);
  assert.equal(providers.every((provider) => !provider.available), true);
  assert.match(providers[0]?.detail ?? "", /unreachable/);
  assert.deepEqual(providers.find((provider) => provider.id === "claude")?.models.map((model) => model.id), ["", "fable", "opus", "sonnet", "haiku"]);
});
