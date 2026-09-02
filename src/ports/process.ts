export type ProcessDefinition = {
  id: string;
  command: string;
  args?: readonly string[];
  cwd: string;
  env?: Record<string, string>;
};

export type ProcessState = "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";

export type ProcessHandle = {
  id: string;
  pid: number;
  state: ProcessState;
};

export type ProcessEvidence = {
  id: string;
  state: ProcessState;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export interface ProcessPort {
  start(definition: ProcessDefinition): Promise<ProcessHandle>;
  stop(handle: ProcessHandle, timeoutMs?: number): Promise<ProcessEvidence>;
}
