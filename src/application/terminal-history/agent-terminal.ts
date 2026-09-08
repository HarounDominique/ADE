export type TerminalAgentProvider = "claude" | "codex" | "opencode";

const commandProvider: Record<string, TerminalAgentProvider> = {
  claude: "claude",
  codex: "codex",
  opencode: "opencode",
};

/** Identifies only a simple executable invocation. Shell aliases and pipelines
    are deliberately ignored: a missed session is safer than recording a manual one. */
export function terminalAgentProvider(input: string): TerminalAgentProvider | undefined {
  const command = input.trim().match(/^(?:env\s+)?(?:\S+[\\/])?([^\s\\/]+)(?:\s|$)/)?.[1]?.toLowerCase();
  if (!command) return undefined;
  return commandProvider[command.replace(/\.(?:cmd|exe|bat)$/i, "")];
}

export function fallbackTerminalTitle(provider: TerminalAgentProvider, at: string): string {
  const label = provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : "OpenCode";
  return `${label} session · ${new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function terminalTitleModel(provider: TerminalAgentProvider): string | undefined {
  return provider === "claude" ? "haiku" : provider === "codex" ? "gpt-5.6-luna" : undefined;
}
