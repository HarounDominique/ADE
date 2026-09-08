import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

/** Creation time is the signal, and it cannot be forged with utimes, so these
    fixtures are written inside the window they are matched against. */
function writeSession(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function fixtureHome(): string {
  return mkdtempSync(join(tmpdir(), "ade-provider-session-"));
}

function windowSince(openedAt: number): { startedAt: string; endedAt: string } {
  return { startedAt: new Date(openedAt).toISOString(), endedAt: new Date().toISOString() };
}

const claudeProjects = (home: string, slug: string) => join(home, ".claude", "projects", slug);

test("a Claude terminal session is matched to the conversation it started", () => {
  const home = fixtureHome();
  const openedAt = Date.now() - 1_000;
  writeSession(join(claudeProjects(home, "-tmp-demo-project"), "11111111-1111-4111-8111-111111111111.jsonl"), "{}\n");
  writeSession(join(claudeProjects(home, "-tmp-other"), "44444444-4444-4444-8444-444444444444.jsonl"), "{}\n");

  assert.equal(resolveProviderSessionId("claude", { repositoryPath: "/tmp/demo project", ...windowSince(openedAt), home }), "11111111-1111-4111-8111-111111111111");
});

/** Taking the most recent of several candidates is what sent an operator into
    the conversation they were having with the editor. */
test("two conversations in one window resolve to none rather than the newer", () => {
  const home = fixtureHome();
  const openedAt = Date.now() - 1_000;
  const directory = claudeProjects(home, "-tmp-demo");
  writeSession(join(directory, "11111111-1111-4111-8111-111111111111.jsonl"), "{}\n");
  writeSession(join(directory, "22222222-2222-4222-8222-222222222222.jsonl"), "{}\n");
  const lookup = { repositoryPath: "/tmp/demo", ...windowSince(openedAt), home };

  assert.equal(resolveProviderSessionId("claude", lookup), undefined);
  // Unless every other candidate already belongs to a session that was saved.
  assert.equal(resolveProviderSessionId("claude", { ...lookup, takenIds: ["11111111-1111-4111-8111-111111111111"] }), "22222222-2222-4222-8222-222222222222");
});

test("a conversation born after the terminal closed is not its conversation", () => {
  const home = fixtureHome();
  // Closed a moment ago, so the conversation written now is plainly the next one.
  const closedAt = Date.now() - 100;
  const lookup = { repositoryPath: "/tmp/demo", startedAt: new Date(closedAt - 1_000).toISOString(), endedAt: new Date(closedAt).toISOString(), home };
  writeSession(join(claudeProjects(home, "-tmp-demo"), "33333333-3333-4333-8333-333333333333.jsonl"), "{}\n");

  assert.equal(resolveProviderSessionId("claude", lookup), undefined);
});

/** A long-lived session in the same directory is written to constantly, so by
    modification time it outranks every other candidate. */
test("a conversation that predates the terminal is never claimed by it", () => {
  const home = fixtureHome();
  const path = join(claudeProjects(home, "-tmp-demo"), "99999999-9999-4999-8999-999999999999.jsonl");
  writeSession(path, "{}\n");
  const openedAt = Date.now() + 50;
  const lookup = { repositoryPath: "/tmp/demo", startedAt: new Date(openedAt).toISOString(), endedAt: new Date(openedAt + 60_000).toISOString(), home };
  writeFileSync(path, "{}\n{}\n");

  assert.equal(resolveProviderSessionId("claude", lookup), undefined);
});

test("a Codex terminal session is matched by the working directory it recorded", () => {
  const home = fixtureHome();
  const openedAt = Date.now() - 1_000;
  const directory = join(home, ".codex", "sessions", "2026", "09", "08");
  const meta = (id: string, cwd: string) => `${JSON.stringify({ type: "session_meta", payload: { session_id: id, cwd } })}\n`;
  writeSession(join(directory, "rollout-2026-09-08T10-24-00-66666666-6666-4666-8666-666666666666.jsonl"), meta("66666666-6666-4666-8666-666666666666", "/tmp/elsewhere"));
  writeSession(join(directory, "rollout-2026-09-08T10-20-00-55555555-5555-4555-8555-555555555555.jsonl"), meta("55555555-5555-4555-8555-555555555555", "/tmp/demo"));

  assert.equal(resolveProviderSessionId("codex", { repositoryPath: "/tmp/demo", ...windowSince(openedAt), home }), "55555555-5555-4555-8555-555555555555");
});

test("an unmatched terminal session resolves to no conversation rather than a guess", () => {
  const home = fixtureHome();
  const lookup = { repositoryPath: "/tmp/demo", ...windowSince(Date.now() - 1_000), home };

  assert.equal(resolveProviderSessionId("claude", lookup), undefined);
  assert.equal(resolveProviderSessionId("codex", lookup), undefined);
  // OpenCode keeps its sessions in a database with no per-session CLI resume.
  assert.equal(resolveProviderSessionId("opencode", lookup), undefined);
});
