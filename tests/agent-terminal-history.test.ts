import test from "node:test";
import assert from "node:assert/strict";
import { fallbackTerminalTitle, terminalAgentProvider, terminalTitleModel } from "../src/application/terminal-history/agent-terminal.js";

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
