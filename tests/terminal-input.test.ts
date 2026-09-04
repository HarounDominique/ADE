import test from "node:test";
import assert from "node:assert/strict";
import { encodeTerminalKey, isInteractiveTerminal } from "../desktop/src/terminal-input.js";

const key = (value: string, overrides: Record<string, boolean> = {}) => ({ key: value, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides });

test("interactive terminal encodes navigation and selection keys for a PTY", () => {
  assert.equal(encodeTerminalKey(key("ArrowUp")), "\u001b[A");
  assert.equal(encodeTerminalKey(key("ArrowDown")), "\u001b[B");
  assert.equal(encodeTerminalKey(key(" ")), " ");
  assert.equal(encodeTerminalKey(key("Enter")), "\r");
  assert.equal(encodeTerminalKey(key("Escape")), "\u001b");
  assert.equal(encodeTerminalKey(key("Tab")), "\t");
  assert.equal(encodeTerminalKey(key("Tab", { shiftKey: true })), "\u001b[Z");
});

test("interactive terminal encodes control keys without consuming shell shortcuts", () => {
  assert.equal(encodeTerminalKey(key("c", { ctrlKey: true })), "\u0003");
  assert.equal(encodeTerminalKey(key("d", { ctrlKey: true })), "\u0004");
  assert.equal(encodeTerminalKey(key("c", { metaKey: true })), null);
  assert.equal(encodeTerminalKey(key("x")), "x");
});

test("only an active alternate-screen PTY enters interactive mode", () => {
  assert.equal(isInteractiveTerminal({ started: false, emulator: { alternate: true } }), false);
  assert.equal(isInteractiveTerminal({ started: true, emulator: { alternate: false } }), false);
  assert.equal(isInteractiveTerminal({ started: true, emulator: { alternate: true } }), true);
});
