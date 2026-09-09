import type { AgentRuntimePort } from "../ports/agent-runtime.js";
import type { ReviewerPort } from "../ports/reviewer.js";
import { ClaudeCliRuntime } from "./claude-cli-runtime.js";
import { CodexCliRuntime } from "./codex-cli-runtime.js";
import { OpenCodeHttpRuntime } from "./opencode-http-runtime.js";
import { OpenCodeReviewer } from "./opencode-reviewer.js";
import { CliReviewer } from "./cli-reviewer.js";

export const agentProviders = ["opencode", "codex", "claude"] as const;
export type AgentProvider = (typeof agentProviders)[number];

export function isAgentProvider(value: unknown): value is AgentProvider {
  return typeof value === "string" && (agentProviders as readonly string[]).includes(value);
}

/** One place decides which runtime a provider means. Three copies of this
    choice is how a provider ends up supported for turns and not for review. */
export function createAgentRuntime(provider: AgentProvider): AgentRuntimePort {
  if (provider === "claude") return new ClaudeCliRuntime();
  if (provider === "codex") return new CodexCliRuntime();
  return new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
}

export function createReviewer(provider: AgentProvider): ReviewerPort {
  if (provider === "opencode") return new OpenCodeReviewer(createAgentRuntime(provider));
  return new CliReviewer(createAgentRuntime(provider), `${provider}-reviewer`);
}
