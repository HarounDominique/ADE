import test from "node:test";
import assert from "node:assert/strict";
import { CodexCliRuntime, executeCodexCommand, extractCodexSessionId } from "../src/adapters/codex-cli-runtime.js";

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
    ["exec", "--sandbox", "read-only", "--cd", "/tmp/project", "--json", "First turn"],
    ["exec", "--sandbox", "read-only", "resume", "real-codex-session", "--json", "Second turn"],
  ]);
});

test("Codex CLI maps write and network permissions to supported execution flags", async () => {
  const calls: string[][] = [];
  const runtime = new CodexCliRuntime("codex", async (_command, args) => {
    calls.push(args);
    return { stdout: '{"type":"thread.started","thread_id":"permission-session"}\n{"type":"turn.completed"}\n' };
  });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  await runtime.prompt(session, { text: "Write a file", grantedPermissions: ["write_code"] });
  await runtime.prompt(session, { text: "Search the web", grantedPermissions: ["network"] });
  assert.deepEqual(calls, [
    ["exec", "--sandbox", "workspace-write", "--cd", "/tmp/project", "--json", "Write a file"],
    ["--search", "exec", "--sandbox", "read-only", "resume", "permission-session", "--json", "Search the web"],
  ]);
});

test("Codex CLI forwards a selected model to the execution", async () => {
  const calls: string[][] = [];
  const runtime = new CodexCliRuntime("codex", async (_command, args) => {
    calls.push(args);
    return { stdout: '{"type":"thread.started","thread_id":"model-session"}\n' };
  });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  await runtime.prompt(session, { text: "Use the selected model", model: "gpt-5.4" });
  assert.deepEqual(calls[0], ["--model", "gpt-5.6-terra", "exec", "--sandbox", "read-only", "--cd", "/tmp/project", "--json", "Use the selected model"]);
});

test("Codex CLI migrates retired models for a new session and preserves the resumed model", async () => {
  const calls: string[][] = [];
  const runtime = new CodexCliRuntime("codex", async (_command, args) => {
    calls.push(args);
    return { stdout: args.includes("resume") ? '{"type":"turn.completed"}\n' : '{"type":"thread.started","thread_id":"current-model-session"}\n' };
  });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  await runtime.prompt(session, { text: "First", model: "gpt-5.4" });
  await runtime.prompt(session, { text: "Second", model: "gpt-5.4" });
  assert.deepEqual(calls, [
    ["--model", "gpt-5.6-terra", "exec", "--sandbox", "read-only", "--cd", "/tmp/project", "--json", "First"],
    ["exec", "--sandbox", "read-only", "resume", "current-model-session", "--json", "Second"],
  ]);
});

test("Codex CLI accepts common structured session event shapes", () => {
  assert.equal(extractCodexSessionId('{"thread":{"id":"thread-session"}}'), "thread-session");
  assert.equal(extractCodexSessionId('{"session_id":"session-id"}'), "session-id");
  assert.equal(extractCodexSessionId('{"type":"turn.completed"}'), undefined);
});

test("Codex CLI forwards incremental agent-message events while a turn is running", async () => {
  const events: unknown[] = [];
  const runtime = new CodexCliRuntime("codex", async (_command, _args, options) => {
    options.onStdout?.('{"type":"thread.started","thread_id":"codex-stream"}\n');
    options.onStdout?.('{"type":"item.updated","item":{"id":"msg-1","type":"agent_message","text":"Hel"}}\n');
    options.onStdout?.('{"type":"item.updated","item":{"id":"msg-1","type":"agent_message","text":"Hello"}}\n');
    return { stdout: '{"type":"thread.started","thread_id":"codex-stream"}\n{"type":"item.completed","item":{"id":"msg-1","type":"agent_message","text":"Hello"}}\n' };
  });
  await runtime.prompt({ id: "codex-pending-stream", directory: "/tmp" }, { text: "hi", onEvent: (event) => events.push(event) });
  assert.equal(events.length, 3);
  assert.equal((events[1] as { payload: { item: { text: string } } }).payload.item.text, "Hel");
});

test("Codex command closes stdin for non-interactive execution", async () => {
  const result = await executeCodexCommand(process.execPath, ["-e", "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('STDIN_CLOSED'))"], { cwd: process.cwd(), maxBuffer: 1024 });
  assert.equal(result.stdout, "STDIN_CLOSED");
});
