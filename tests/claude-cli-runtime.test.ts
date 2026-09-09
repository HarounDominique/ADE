import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeCliRuntime, executeClaudeCommand, extractClaudeSessionId, extractClaudePressure, extractClaudeText, extractClaudeUsage } from "../src/adapters/claude-cli-runtime.js";

test("a read-only turn does not plan, so the requested model survives", async () => {
  // `--permission-mode plan` enforces a minimum model tier and substitutes its
  // own below it: asking for Haiku ran Sonnet. Read-only is enforced by the
  // allowed-tools list, not by plan mode.
  const calls: string[][] = [];
  const runtime = new ClaudeCliRuntime("claude", async (_command, args) => {
    calls.push(args);
    return { stdout: JSON.stringify({ result: "ok", session_id: "11111111-2222-3333-4444-555555555555" }) };
  });
  await runtime.prompt({ id: "claude-pending-11111111-2222-3333-4444-555555555555", directory: "/tmp" }, { text: "hi", model: "haiku" });
  const args = calls[0] ?? [];
  assert.ok(!args.includes("plan"), "a read-only turn must not run in plan mode");
  assert.equal(args[args.indexOf("--model") + 1], "haiku");
  assert.ok(args.includes("--allowed-tools"));
});

test("Claude Code CLI creates a resumable session and maps permissions", async () => {
  const calls: string[][] = [];
  const runtime = new ClaudeCliRuntime("claude", async (_command, args) => {
    calls.push(args);
    return { stdout: args.includes("--resume") ? JSON.stringify({ result: "Second response", session_id: "claude-session" }) : JSON.stringify({ result: "First response", session_id: "claude-session" }) };
  });
  const session = await runtime.createSession({ directory: "/tmp/project" });
  const firstSessionId = session.id.replace(/^claude-pending-/, "");
  await runtime.prompt(session, { text: "Read the project" });
  assert.equal(session.id, "claude-session");
  await runtime.prompt(session, { text: "Update the project", model: "sonnet", grantedPermissions: ["write_code", "run_commands", "network"] });
  assert.deepEqual(calls, [
    ["--print", "--output-format", "stream-json", "--include-partial-messages", "--permission-mode", "default", "--permission-prompts", "none", "--allowed-tools", "Read,Glob,Grep", "--session-id", firstSessionId, "Read the project"],
    ["--print", "--output-format", "stream-json", "--include-partial-messages", "--permission-mode", "acceptEdits", "--permission-prompts", "none", "--allowed-tools", "Read,Glob,Grep,Edit,Write,Bash,WebFetch,WebSearch", "--model", "sonnet", "--resume", "claude-session", "Update the project"],
  ]);
});

test("Claude Code forwards public text deltas while a turn is running", async () => {
  const events: unknown[] = [];
  const runtime = new ClaudeCliRuntime("claude", async (_command, _args, options) => {
    options.onStdout?.('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}}\n');
    options.onStdout?.('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}}\n');
    return { stdout: '{"type":"result","session_id":"claude-stream","result":"Hello"}\n' };
  });
  await runtime.prompt({ id: "claude-pending-stream", directory: "/tmp" }, { text: "hi", onEvent: (event) => events.push(event) });
  assert.deepEqual(events.map((event) => (event as { payload: unknown }).payload), [
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } } },
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "lo" } } },
  ]);
});

test("Claude Code CLI extracts JSON result and session id", () => {
  const output = JSON.stringify({ result: "Done", session_id: "session-1" });
  assert.equal(extractClaudeText(output), "Done");
  assert.equal(extractClaudeSessionId(output), "session-1");
  assert.equal(extractClaudeSessionId(JSON.stringify({ result: "Done" })), undefined);
  assert.equal(extractClaudeText('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}}\n{"type":"result","result":"Hello"}'), "Hello");
});

test("Claude command closes stdin for non-interactive execution", async () => {
  const result = await executeClaudeCommand(process.execPath, ["-e", "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('STDIN_CLOSED'))"], { cwd: process.cwd(), maxBuffer: 1024 });
  assert.equal(result.stdout, "STDIN_CLOSED");
});

test("Claude Code accounts for the turn from its result event", () => {
  const stdout = [
    JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 12, output_tokens: 30, cache_read_input_tokens: 900 } } }),
    JSON.stringify({ type: "result", result: "done", usage: { input_tokens: 40, output_tokens: 120, cache_read_input_tokens: 2_400, cache_creation_input_tokens: 600 }, total_cost_usd: 0.0125 }),
  ].join("\n");

  // The result event already aggregates every request the turn made, so the
  // per-request assistant usage must not be added on top of it.
  assert.deepEqual(extractClaudeUsage(stdout), { inputTokens: 40, outputTokens: 120, cacheReadInputTokens: 2_400, cacheCreationInputTokens: 600, costUsd: 0.0125 });
});

test("Claude Code falls back to per-request usage when a turn reports no result", () => {
  const stdout = [
    JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 } } }),
    JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 4, output_tokens: 7, cache_creation_input_tokens: 50 } } }),
  ].join("\n");

  assert.deepEqual(extractClaudeUsage(stdout), { inputTokens: 14, outputTokens: 12, cacheReadInputTokens: 100, cacheCreationInputTokens: 50 });
  // A turn nobody accounted for has no usage: reporting zeros would read as a
  // free turn.
  assert.equal(extractClaudeUsage('{"type":"result","result":"done"}'), undefined);
  assert.equal(extractClaudeUsage(undefined), undefined);
});

test("Claude Code reports what the context holds and stays silent about plan windows", () => {
  const result = JSON.parse(JSON.stringify({
    type: "result",
    usage: { input_tokens: 4_000, output_tokens: 900, cache_read_input_tokens: 120_000, cache_creation_input_tokens: 6_000 },
    modelUsage: { "claude-opus-5": { inputTokens: 4_000 } },
  }));

  const pressure = extractClaudePressure(result);
  // `--print` carries no five-hour or weekly window, so neither is claimed.
  assert.equal(pressure?.session, undefined);
  assert.equal(pressure?.weekly, undefined);
  // Cached tokens are stored apart for accounting but still occupy the window.
  assert.deepEqual(pressure, { context: { usedTokens: 130_000, windowTokens: 1_000_000 } });
  assert.equal(extractClaudePressure({ type: "system" }), undefined);
});

test("Claude Code sizes the context by the model, and leaves it unsized when it cannot", () => {
  const withModel = (model: string) => extractClaudePressure({ type: "assistant", message: { model, usage: { input_tokens: 1_000, output_tokens: 10 } } });
  assert.equal(withModel("claude-haiku-4-5")?.context?.windowTokens, 200_000);
  assert.equal(withModel("claude-sonnet-5")?.context?.windowTokens, 1_000_000);
  // An alias ADE cannot place reports its tokens without inventing a window.
  assert.deepEqual(withModel("some-future-model")?.context, { usedTokens: 1_000 });
});

test("Claude Code plan windows are read if the CLI ever reports them", () => {
  const pressure = extractClaudePressure({ type: "result", usage: { input_tokens: 10, output_tokens: 5 }, rate_limits: { five_hour: { used_percentage: 42.5 }, seven_day: { used_percentage: 8 } } });
  assert.equal(pressure?.session?.usedPercent, 42.5);
  assert.equal(pressure?.weekly?.usedPercent, 8);
});
