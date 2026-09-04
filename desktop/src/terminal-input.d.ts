export function encodeTerminalKey(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): string | null;

export function isInteractiveTerminal(tab: {
  started?: boolean;
  interactive?: boolean;
  emulator?: { alternate?: boolean } | null;
} | null | undefined): boolean;

export function commandMayOpenInteractiveTerminal(command: string): boolean;
