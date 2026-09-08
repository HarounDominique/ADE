import test from "node:test";
import assert from "node:assert/strict";
import { CodexCliRuntime, executeCodexCommand, extractCodexPressure, extractCodexSessionId, extractCodexUsage } from "../src/adapters/codex-cli-runtime.js";

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

test("Codex reports thread totals with cached input counted apart", () => {
  const stdout = [
    JSON.stringify({ type: "thread.started", thread_id: "codex-usage" }),
    JSON.stringify({ type: "token_count", info: { total_token_usage: { input_tokens: 5_000, cached_input_tokens: 4_200, output_tokens: 900, total_tokens: 5_900 }, last_token_usage: { input_tokens: 1_000, cached_input_tokens: 800, output_tokens: 100 } } }),
  ].join("\n");

  // `input_tokens` includes the cached ones; ADE stores them apart so a Codex
  // row means what a Claude Code row means.
  assert.deepEqual(extractCodexUsage(stdout), { inputTokens: 800, outputTokens: 900, cacheReadInputTokens: 4_200, cacheCreationInputTokens: 0 });
});

test("Codex usage tolerates the older nested event shape and reports nothing when absent", () => {
  assert.deepEqual(extractCodexUsage('{"id":"0","msg":{"type":"token_count","input_tokens":300,"cached_input_tokens":100,"output_tokens":40}}'), { inputTokens: 200, outputTokens: 40, cacheReadInputTokens: 100, cacheCreationInputTokens: 0 });
  assert.equal(extractCodexUsage('{"type":"turn.completed"}'), undefined);
  assert.equal(extractCodexUsage(undefined), undefined);
});

test("Codex reports the context it holds and both plan windows", () => {
  const event = {
    type: "token_count",
    info: {
      last_token_usage: { input_tokens: 90_000, cached_input_tokens: 80_000, output_tokens: 1_200, total_tokens: 91_200 },
      model_context_window: 272_000,
      rate_limits: { primary: { used_percent: 37, window_minutes: 300, resets_in_seconds: 3_600 }, secondary: { used_percent: 12, window_minutes: 10_080 } },
    },
  };

  const pressure = extractCodexPressure(event);
  assert.deepEqual(pressure?.context, { usedTokens: 91_200, windowTokens: 272_000 });
  // The windows are told apart by their own length, not by the order they arrive in.
  assert.equal(pressure?.session?.usedPercent, 37);
  assert.equal(pressure?.session?.windowMinutes, 300);
  assert.ok(pressure?.session?.resetsAt);
  assert.equal(pressure?.weekly?.usedPercent, 12);
});

test("Codex pressure survives the older event shape and reports nothing when absent", () => {
  const pressure = extractCodexPressure({ msg: { type: "token_count", rate_limits: { secondary: { used_percent: 5, window_minutes: 10_080 } } } });
  assert.equal(pressure?.weekly?.usedPercent, 5);
  assert.equal(pressure?.session, undefined);
  assert.equal(extractCodexPressure({ type: "turn.completed" }), undefined);
  assert.equal(extractCodexPressure("not an event"), undefined);
});
