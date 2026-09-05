import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeCliRuntime, executeClaudeCommand, extractClaudeSessionId, extractClaudeText } from "../src/adapters/claude-cli-runtime.js";

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
    ["--print", "--output-format", "json", "--permission-mode", "plan", "--permission-prompts", "none", "--allowed-tools", "Read,Glob,Grep", "--session-id", firstSessionId, "Read the project"],
    ["--print", "--output-format", "json", "--permission-mode", "acceptEdits", "--permission-prompts", "none", "--allowed-tools", "Read,Glob,Grep,Edit,Write,Bash,WebFetch,WebSearch", "--model", "sonnet", "--resume", "claude-session", "Update the project"],
  ]);
});

test("Claude Code CLI extracts JSON result and session id", () => {
  const output = JSON.stringify({ result: "Done", session_id: "session-1" });
  assert.equal(extractClaudeText(output), "Done");
  assert.equal(extractClaudeSessionId(output), "session-1");
  assert.equal(extractClaudeSessionId(JSON.stringify({ result: "Done" })), undefined);
});

test("Claude command closes stdin for non-interactive execution", async () => {
  const result = await executeClaudeCommand(process.execPath, ["-e", "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('STDIN_CLOSED'))"], { cwd: process.cwd(), maxBuffer: 1024 });
  assert.equal(result.stdout, "STDIN_CLOSED");
});
