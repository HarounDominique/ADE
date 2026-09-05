export type AgentProvider = {
  id: string;
  label: string;
  transport: "http" | "cli";
  capability: readonly string[];
  auth: "local" | "external";
  models: readonly AgentModel[];
};

export type AgentModel = {
  id: string;
  label: string;
};

const providerDefault: AgentModel = { id: "", label: "Provider default" };

export const nativeProviders: readonly AgentProvider[] = [
  { id: "opencode", label: "OpenCode", transport: "http", capability: ["implement", "review", "events"], auth: "local", models: [providerDefault] },
  { id: "codex", label: "Codex", transport: "cli", capability: ["implement", "review"], auth: "external", models: [providerDefault, { id: "gpt-5.5", label: "GPT-5.5" }, { id: "gpt-5.4", label: "GPT-5.4" }, { id: "gpt-5.4-mini", label: "GPT-5.4 mini" }] },
  { id: "claude", label: "Claude Code", transport: "cli", capability: ["implement", "review"], auth: "external", models: [providerDefault, { id: "opus", label: "Claude Opus" }, { id: "sonnet", label: "Claude Sonnet" }, { id: "haiku", label: "Claude Haiku" }] },
];
