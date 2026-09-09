import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { readSettings, writeSettings } from "../src/application/settings/settings.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";

test("an install with no preferences yet has defaults, not emptiness", () => {
  const store = new AdeStore();
  assert.deepEqual(readSettings(store), { turnChime: true, defaultModels: {} });
});

test("a write states only what changes and leaves the rest standing", () => {
  const store = new AdeStore();

  writeSettings(store, { defaultModels: { claude: "sonnet" } });
  writeSettings(store, { turnChime: false });

  const settings = readSettings(store);
  assert.equal(settings.turnChime, false);
  // Silencing the chime must not erase a default model set from another surface.
  assert.deepEqual(settings.defaultModels, { claude: "sonnet" });

  writeSettings(store, { defaultModels: { codex: "gpt-5.6" } });
  assert.deepEqual(readSettings(store).defaultModels, { claude: "sonnet", codex: "gpt-5.6" });

  // Clearing a default removes it rather than storing a model named "".
  writeSettings(store, { defaultModels: { claude: "" } });
  assert.deepEqual(readSettings(store).defaultModels, { codex: "gpt-5.6" });
});

test("preferences survive the process, because they are not the webview's", () => {
  const store = new AdeStore();
  writeSettings(store, { turnChime: false, updateFeedUrl: "  https://example.test/latest.json  " });

  // Trimmed on the way in: a pasted URL with spaces is the same URL.
  assert.equal(readSettings(store).updateFeedUrl, "https://example.test/latest.json");
  // A second reader of the same database sees them; localStorage never was.
  const reader = new AdeStore();
  reader.setSetting("user", store.getSetting("user"));
  assert.equal(readSettings(reader).turnChime, false);
});

test("the shell reads and writes preferences through the sidecar", () => {
  const store = new AdeStore();

  const initial = handleDesktopRequest(store, { id: "1", method: "settings.read" });
  assert.deepEqual(initial.result, { turnChime: true, defaultModels: {} });

  const written = handleDesktopRequest(store, { id: "2", method: "settings.write", params: { settings: { turnChime: false, updateFeedUrl: "https://example.test/latest.json" } } });
  assert.equal((written.result as { turnChime: boolean }).turnChime, false);
  assert.equal((handleDesktopRequest(store, { id: "3", method: "settings.read" }).result as { updateFeedUrl?: string }).updateFeedUrl, "https://example.test/latest.json");

  const empty = handleDesktopRequest(store, { id: "4", method: "settings.write" });
  assert.equal(empty.error?.code, "INVALID_PARAMS");
});
