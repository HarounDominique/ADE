import test from "node:test";
import assert from "node:assert/strict";
import { TerminalEmulator } from "../desktop/src/terminal-emulator.js";

test("terminal emulator renders text without exposing ANSI control bytes", () => {
  const terminal = new TerminalEmulator({ rows: 4, columns: 60 });

  terminal.write("\u001b]0;Claude Code\u0007\u001b[?25lhello\u001b[0m");

  assert.equal(terminal.text(), "hello");
  assert.doesNotMatch(terminal.text(), /\u001b|\[\?/);
});

test("terminal emulator applies cursor movement and screen erasure", () => {
  const terminal = new TerminalEmulator({ rows: 4, columns: 20 });

  terminal.write("abc\u001b[2DX");
  assert.equal(terminal.text(), "aXc");

  terminal.write("\u001b[2J\u001b[HClaude");
  assert.equal(terminal.text(), "Claude");
});

test("terminal emulator restores the shell after an alternate-screen TUI", () => {
  const terminal = new TerminalEmulator({ rows: 4, columns: 60 });

  terminal.write("$ pwd\r\n/Users/user/Documents/workspace/ADE");
  terminal.write("\u001b[?1049h\u001b[2J\u001b[HClaude Code");
  assert.equal(terminal.text(), "Claude Code");

  terminal.write("\u001b[?1049l");
  assert.equal(terminal.text(), "$ pwd\n/Users/user/Documents/workspace/ADE");
});

test("terminal emulator handles escape sequences split across PTY chunks", () => {
  const terminal = new TerminalEmulator({ rows: 2, columns: 12 });

  terminal.write("\u001b[2");
  terminal.write("J\u001b[Hready");

  assert.equal(terminal.text(), "ready");
});
