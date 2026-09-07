import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultClaudeCommand } from "../../adapters/claude-cli-runtime.js";
import { defaultCodexCommand } from "../../adapters/codex-cli-runtime.js";
import { nativeProviders, type AgentProvider } from "../../domain/agent-provider.js";

const exec = promisify(execFile);

export type ProviderStatus = AgentProvider & { available: boolean; detail: string };

export async function inspectProviders(input: { opencodeUrl?: string; codexCommand?: string; claudeCommand?: string } = {}): Promise<ProviderStatus[]> {
  const opencodeUrl = input.opencodeUrl ?? "http://127.0.0.1:4096";
  const codexCommand = input.codexCommand ?? defaultCodexCommand;
  const claudeCommand = input.claudeCommand ?? defaultClaudeCommand;
  const [opencode, codex, claude] = await Promise.all([
    fetch(`${opencodeUrl}/global/health`).then(async (response) => ({ available: response.ok, detail: response.ok ? `reachable at ${opencodeUrl}` : `HTTP ${response.status}` })).catch(() => ({ available: false, detail: `unreachable at ${opencodeUrl}` })),
    exec(codexCommand, ["--version"], { shell: windowsCommandNeedsShell(codexCommand) }).then(({ stdout }) => ({ available: true, detail: stdout.trim() || `${codexCommand} available` })).catch(() => ({ available: false, detail: `${codexCommand} not found` })),
    exec(claudeCommand, ["--version"], { shell: windowsCommandNeedsShell(claudeCommand) }).then(({ stdout }) => ({ available: true, detail: stdout.trim() || `${claudeCommand} available` })).catch(() => ({ available: false, detail: `${claudeCommand} not found` })),
  ]);
  return nativeProviders.map((provider) => ({ ...provider, ...(provider.id === "opencode" ? opencode : provider.id === "codex" ? codex : claude) }));
}

function windowsCommandNeedsShell(command: string): boolean {
  return process.platform === "win32" && (!/\.[^\\/]+$/.test(command) || /\.(?:cmd|bat)$/i.test(command));
}
