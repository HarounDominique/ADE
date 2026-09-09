export type RunMode = "run" | "debug";

export type RunPort = {
  name?: string;
  port: number;
  protocol: "http" | "tcp";
  path?: string;
  bind: "loopback" | "all";
};

export type RunDebug = {
  /** Replaces `args` when the configuration runs in debug mode: a debug flag
      usually has to precede the entry point, so extending would place it
      wrong for most runtimes. */
  args: readonly string[];
  port: number;
  protocol: "inspector" | "jdwp" | "dap" | "other";
  attachHint?: string;
};

export type RunHealthcheck = {
  type: "http" | "command";
  target: string;
  timeoutMs: number;
};

/** A run whose result ADE is willing to cite as a gate. The name says what the
    evidence proves, not which command produced it: a Project decides whether
    its `build` is Maven, Cargo or a script of its own. */
export type RunVerification = "build" | "tests";

export type RunConfiguration = {
  id: string;
  label: string;
  kind: "command" | "service" | "compound";
  /** When set, finishing this run writes evidence the matching gate reads. */
  verifies?: RunVerification;
  command?: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
  service?: string;
  members?: readonly string[];
  ports?: readonly RunPort[];
  debug?: RunDebug;
  healthcheck?: RunHealthcheck;
  autoOpen?: boolean;
  shutdownTimeoutMs?: number;
};

/** A configuration whose service reference has already been expanded, so the
    supervisor never has to know where the command came from. */
export type ResolvedRunConfiguration = RunConfiguration & {
  command?: string;
  cwd?: string;
};

export type RunSessionState = "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";

export type RunSession = {
  id: string;
  configurationId: string;
  mode: RunMode;
  state: RunSessionState;
  parentId?: string;
  pid?: number;
  ports: readonly RunPort[];
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  stoppedByUser?: boolean;
  failure?: string;
};

export function runConfigurationUrl(port: RunPort): string | undefined {
  if (port.protocol !== "http") return undefined;
  return `http://localhost:${port.port}${port.path ?? ""}`;
}
