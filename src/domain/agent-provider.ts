export type AgentProvider = {
  id: string;
  label: string;
  transport: "http" | "cli";
  capability: readonly string[];
  auth: "local" | "external";
};

export const nativeProviders: readonly AgentProvider[] = [
  { id: "opencode", label: "OpenCode", transport: "http", capability: ["implement", "review", "events"], auth: "local" },
  { id: "codex", label: "Codex", transport: "cli", capability: ["implement", "review"], auth: "external" },
];
