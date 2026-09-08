export type ProcessDefinition = {
  id: string;
  command: string;
  args?: readonly string[];
  cwd: string;
  env?: Record<string, string>;
  /** Output as it happens. `stop` still returns the whole capture; a console
      that only fills in when the process dies is not a console. */
  onOutput?: (chunk: { stream: "stdout" | "stderr"; text: string }) => void;
  /** A process may fail after spawn succeeds. Report that transition so a
      run is not left looking RUNNING after its command has already exited. */
  onExit?: (evidence: ProcessEvidence) => void;
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
