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
