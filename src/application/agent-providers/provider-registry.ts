import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultCodexCommand } from "../../adapters/codex-cli-runtime.js";
import { nativeProviders, type AgentProvider } from "../../domain/agent-provider.js";

const exec = promisify(execFile);

export type ProviderStatus = AgentProvider & { available: boolean; detail: string };

export async function inspectProviders(input: { opencodeUrl?: string; codexCommand?: string } = {}): Promise<ProviderStatus[]> {
  const opencodeUrl = input.opencodeUrl ?? "http://127.0.0.1:4096";
  const codexCommand = input.codexCommand ?? defaultCodexCommand;
  const [opencode, codex] = await Promise.all([
    fetch(`${opencodeUrl}/global/health`).then(async (response) => ({ available: response.ok, detail: response.ok ? `reachable at ${opencodeUrl}` : `HTTP ${response.status}` })).catch(() => ({ available: false, detail: `unreachable at ${opencodeUrl}` })),
    exec(codexCommand, ["--version"]).then(({ stdout }) => ({ available: true, detail: stdout.trim() || `${codexCommand} available` })).catch(() => ({ available: false, detail: `${codexCommand} not found` })),
  ]);
  return nativeProviders.map((provider) => ({ ...provider, ...(provider.id === "opencode" ? opencode : codex) }));
}
