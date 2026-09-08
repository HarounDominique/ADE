import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fallbackTerminalTitle, terminalAgentProvider, terminalTitleModel } from "../src/application/terminal-history/agent-terminal.js";
import { resolveProviderSessionId } from "../src/application/terminal-history/provider-session-id.js";

test("only recognized terminal executables create agent history", () => {
  assert.equal(terminalAgentProvider("claude"), "claude");
  assert.equal(terminalAgentProvider("C:/tools/codex.exe exec"), "codex");
  assert.equal(terminalAgentProvider("opencode.cmd"), "opencode");
  assert.equal(terminalAgentProvider("echo claude"), undefined);
  assert.equal(terminalAgentProvider("npm run codex"), undefined);
});

test("terminal titles select the economical model or safe fallback", () => {
  assert.equal(terminalTitleModel("claude"), "haiku");
  assert.equal(terminalTitleModel("codex"), "gpt-5.6-luna");
  assert.equal(terminalTitleModel("opencode"), undefined);
  assert.match(fallbackTerminalTitle("claude", "2026-09-08T10:00:00.000Z"), /^Claude session/);
});

const started = "2026-09-08T10:00:00.000Z";
const ended = "2026-09-08T10:30:00.000Z";

function writeSession(path: string, contents: string, at: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  const when = new Date(at);
  utimesSync(path, when, when);
}

function fixtureHome(): string {
  return mkdtempSync(join(tmpdir(), "ade-provider-session-"));
}

test("a Claude terminal session is matched to the conversation it wrote", () => {
  const home = fixtureHome();
  const directory = join(home, ".claude", "projects", "-tmp-demo-project");
  writeSession(join(directory, "11111111-1111-4111-8111-111111111111.jsonl"), "{}\n", "2026-09-08T10:25:00.000Z");
  writeSession(join(directory, "22222222-2222-4222-8222-222222222222.jsonl"), "{}\n", "2026-09-08T10:05:00.000Z");
  writeSession(join(directory, "33333333-3333-4333-8333-333333333333.jsonl"), "{}\n", "2026-09-08T08:00:00.000Z");
  writeSession(join(home, ".claude", "projects", "-tmp-other", "44444444-4444-4444-8444-444444444444.jsonl"), "{}\n", "2026-09-08T10:26:00.000Z");
  const lookup = { repositoryPath: "/tmp/demo project", startedAt: started, endedAt: ended, home };

  assert.equal(resolveProviderSessionId("claude", lookup), "11111111-1111-4111-8111-111111111111");
  assert.equal(resolveProviderSessionId("claude", { ...lookup, takenIds: ["11111111-1111-4111-8111-111111111111"] }), "22222222-2222-4222-8222-222222222222");
});

test("a Codex terminal session is matched by the working directory it recorded", () => {
  const home = fixtureHome();
  const directory = join(home, ".codex", "sessions", "2026", "09", "08");
  const meta = (id: string, cwd: string) => `${JSON.stringify({ type: "session_meta", payload: { session_id: id, cwd } })}\n`;
  writeSession(join(directory, "rollout-2026-09-08T10-20-00-55555555-5555-4555-8555-555555555555.jsonl"), meta("55555555-5555-4555-8555-555555555555", "/tmp/demo"), "2026-09-08T10:20:00.000Z");
  writeSession(join(directory, "rollout-2026-09-08T10-24-00-66666666-6666-4666-8666-666666666666.jsonl"), meta("66666666-6666-4666-8666-666666666666", "/tmp/elsewhere"), "2026-09-08T10:24:00.000Z");
  const lookup = { repositoryPath: "/tmp/demo", startedAt: started, endedAt: ended, home };

  assert.equal(resolveProviderSessionId("codex", lookup), "55555555-5555-4555-8555-555555555555");
});

test("an unmatched terminal session resolves to no conversation rather than a guess", () => {
  const home = fixtureHome();
  const lookup = { repositoryPath: "/tmp/demo", startedAt: started, endedAt: ended, home };

  assert.equal(resolveProviderSessionId("claude", lookup), undefined);
  assert.equal(resolveProviderSessionId("codex", lookup), undefined);
  // OpenCode keeps its sessions in a database with no per-session CLI resume.
  assert.equal(resolveProviderSessionId("opencode", { ...lookup, home }), undefined);
});
