export type RuntimeEvent = {
  type: string;
  payload: unknown;
};

export type SessionHandle = {
  id: string;
  directory: string;
};

export type AgentPermission = "read_project" | "write_code" | "write_docs" | "run_commands" | "network";

export type AgentPromptInput = {
  text: string;
  agent?: string;
  model?: string;
  grantedPermissions?: readonly AgentPermission[];
  /** Internal bridge used by the desktop shell for provider-emitted events. */
  onEvent?: (event: RuntimeEvent) => void;
};

/** What one turn cost the provider. Tokens are counted by the provider, not
    inferred by ADE: a turn that reports nothing has no usage, never a zero. */
export type TurnUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUsd?: number;
};

export type FileDiff = {
  path?: string;
  additions?: number;
  deletions?: number;
  [key: string]: unknown;
};

export type StructuredPrompt = {
  text: string;
  agent?: string;
  model?: string;
  format: {
    type: "json_schema";
    schema: Record<string, unknown>;
    retryCount?: number;
  };
};

export interface AgentRuntimePort {
  health(): Promise<{ healthy: boolean; version?: string }>;
  createSession(input: { directory: string; title?: string }): Promise<SessionHandle>;
  prompt(session: SessionHandle, input: AgentPromptInput): Promise<unknown>;
  promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown>;
  events(signal?: AbortSignal): AsyncIterable<RuntimeEvent>;
  diff(session: SessionHandle): Promise<readonly FileDiff[]>;
  abort(session: SessionHandle): Promise<void>;
}
