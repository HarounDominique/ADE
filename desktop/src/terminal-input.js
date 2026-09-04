const specialKeys = {
  ArrowUp: '\u001b[A',
  ArrowDown: '\u001b[B',
  ArrowRight: '\u001b[C',
  ArrowLeft: '\u001b[D',
  Home: '\u001b[H',
  End: '\u001b[F',
  PageUp: '\u001b[5~',
  PageDown: '\u001b[6~',
  Insert: '\u001b[2~',
  Delete: '\u001b[3~',
  Backspace: '\u007f',
  Enter: '\r',
  Escape: '\u001b',
};

function controlCode(key) {
  if (key === ' ') return '\u0000';
  if (key === '[') return '\u001b';
  if (key === '\\') return '\u001c';
  if (key === ']') return '\u001d';
  if (key === '^') return '\u001e';
  if (key === '_') return '\u001f';
  const normalized = key.toLowerCase();
  if (normalized.length !== 1) return null;
  const code = normalized.charCodeAt(0);
  return code >= 97 && code <= 122 ? String.fromCharCode(code - 96) : null;
}

/**
 * Converts a browser key event into the bytes expected by an interactive PTY.
 * Returning null leaves the event to the browser/OS (for example Cmd shortcuts).
 */
export function encodeTerminalKey(event) {
  if (event.metaKey && !event.ctrlKey) return null;
  if (event.key === 'Tab') return event.shiftKey ? '\u001b[Z' : '\t';
  if (event.key === 'Enter' || event.key === 'Escape') return specialKeys[event.key];
  if (event.ctrlKey) return controlCode(event.key);
  if (event.altKey && event.key.length === 1) return `\u001b${event.key}`;
  return specialKeys[event.key] ?? (event.key.length === 1 ? event.key : null);
}

export function isInteractiveTerminal(tab) {
  return Boolean(tab?.started && (tab?.interactive || tab?.emulator?.alternate));
}

export function commandMayOpenInteractiveTerminal(command) {
  return /\b(?:claude|opencode|codex|vim|nvim|nano|top|htop|less|fzf|ssh)\b/i.test(String(command));
}
