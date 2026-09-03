import test from "node:test";
import assert from "node:assert/strict";
import { CodexCliRuntime, extractCodexSessionId } from "../src/adapters/codex-cli-runtime.js";

test("Codex CLI captures its emitted session id and resumes it", async () => {
  const calls: string[][] = [];
  const runtime = new CodexCliRuntime("codex", async (_command, args) => {
    calls.push(args);
    return { stdout: args.includes("resume") ? '{"type":"turn.completed"}\n' : '{"type":"thread.started","thread_id":"real-codex-session"}\n{"type":"turn.completed"}\n' };
  });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  await runtime.prompt(session, { text: "First turn" });
  assert.equal(session.id, "real-codex-session");
  await runtime.prompt(session, { text: "Second turn" });
  assert.deepEqual(calls, [
    ["exec", "--cd", "/tmp/project", "--json", "First turn"],
    ["exec", "resume", "real-codex-session", "Second turn"],
  ]);
});

test("Codex CLI accepts common structured session event shapes", () => {
  assert.equal(extractCodexSessionId('{"thread":{"id":"thread-session"}}'), "thread-session");
  assert.equal(extractCodexSessionId('{"session_id":"session-id"}'), "session-id");
  assert.equal(extractCodexSessionId('{"type":"turn.completed"}'), undefined);
});
