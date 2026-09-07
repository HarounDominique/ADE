import { spawn } from "node:child_process";
import type { ProcessHandle, ProcessPort } from "../../ports/process.js";
import type { PortProbePort } from "../../ports/port-probe.js";
import type {
  ResolvedRunConfiguration,
  RunMode,
  RunPort,
  RunSession,
} from "../../domain/run-configuration.js";
import { RunConfigurationError, declaredPortsByName, substituteRunTokens } from "./run-config.js";

export class RunPortConflictError extends Error {
  constructor(public readonly configurationId: string, public readonly port: number) {
    super(`${configurationId}: port ${port} is already in use`);
    this.name = "RunPortConflictError";
  }
}

export type RunOutputChunk = { sessionId: string; stream: "stdout" | "stderr"; text: string };

export type RunManagerOptions = {
  projectRoot: string;
  onOutput?: (chunk: RunOutputChunk) => void;
  onSession?: (session: RunSession) => void;
  now?: () => Date;
};

type Tracked = {
  session: RunSession;
  handle?: ProcessHandle;
  shutdownTimeoutMs?: number;
  memberSessionIds: string[];
};

/** The supervisor of `local-runtime` owns processes; this owns the order in
    which an operator's configuration turns into them, and the promise that a
    failed start leaves nothing running behind it. */
export class RunManager {
  private readonly tracked = new Map<string, Tracked>();
  private sequence = 0;

  constructor(
    private readonly processes: ProcessPort,
    private readonly ports: PortProbePort,
    private readonly options: RunManagerOptions,
  ) {}

  sessions(): readonly RunSession[] {
    return [...this.tracked.values()].map((entry) => entry.session);
  }

  session(sessionId: string): RunSession | undefined {
    return this.tracked.get(sessionId)?.session;
  }

  async start(catalog: readonly ResolvedRunConfiguration[], configurationId: string, mode: RunMode): Promise<RunSession> {
    const configuration = catalog.find((candidate) => candidate.id === configurationId);
    if (!configuration) throw new RunConfigurationError(configurationId, "id", "no configuration declared with that id");
    if (this.activeSessionFor(configurationId)) throw new RunConfigurationError(configurationId, "id", "this configuration is already running");
    /** Every port of the whole tree is probed before the first process is
        spawned: a conflict discovered halfway leaves an operator with half an
        application running and no memory of which half. */
    await this.assertPortsFree(catalog, configuration, mode);
    return configuration.kind === "compound"
      ? this.startCompound(catalog, configuration, mode)
      : this.startLeaf(catalog, configuration, mode);
  }

  async stop(sessionId: string): Promise<RunSession> {
    const entry = this.tracked.get(sessionId);
    if (!entry) throw new RunConfigurationError(sessionId, "sessionId", "no run session with that id");
    return this.stopEntry(entry, true);
  }

  async stopAll(): Promise<void> {
    for (const entry of [...this.tracked.values()].filter((candidate) => !candidate.session.parentId)) {
      await this.stopEntry(entry, true).catch(() => undefined);
    }
  }

  private activeSessionFor(configurationId: string): RunSession | undefined {
    return this.sessions().find((session) => session.configurationId === configurationId && (session.state === "STARTING" || session.state === "RUNNING"));
  }

  private async assertPortsFree(catalog: readonly ResolvedRunConfiguration[], configuration: ResolvedRunConfiguration, mode: RunMode): Promise<void> {
    for (const leaf of leavesOf(catalog, configuration)) {
      for (const port of portsOf(leaf, mode)) {
        if (await this.ports.inUse(port)) throw new RunPortConflictError(leaf.id, port);
      }
    }
  }

  private async startCompound(catalog: readonly ResolvedRunConfiguration[], configuration: ResolvedRunConfiguration, mode: RunMode): Promise<RunSession> {
    const entry = this.track(configuration, mode, { ports: [] });
    for (const memberId of configuration.members ?? []) {
      const member = catalog.find((candidate) => candidate.id === memberId);
      if (!member) continue;
      const started = member.kind === "compound"
        ? await this.startCompound(catalog, member, mode).catch(() => undefined)
        : await this.startLeaf(catalog, member, mode, entry.session.id).catch(() => undefined);
      if (started) entry.memberSessionIds.push(started.id);
      if (!started || started.state !== "RUNNING") {
        /** The members already up came from this action, so this action takes
            them back down rather than leaving a half-started application. */
        await this.stopMembers(entry);
        return this.settle(entry, { state: "FAILED", failure: `member ${memberId} did not start` });
      }
    }
    return this.settle(entry, { state: "RUNNING" });
  }

  private async startLeaf(catalog: readonly ResolvedRunConfiguration[], configuration: ResolvedRunConfiguration, mode: RunMode, parentId?: string): Promise<RunSession> {
    if (mode === "debug" && !configuration.debug) throw new RunConfigurationError(configuration.id, "debug", "this configuration declares no debug mode");
    if (!configuration.command || !configuration.cwd) throw new RunConfigurationError(configuration.id, "command", "a runnable configuration requires command and cwd");
    const context = { projectRoot: this.options.projectRoot, ports: declaredPortsByName(catalog) };
    const entry = this.track(configuration, mode, { ports: declaredPorts(configuration, mode), ...(parentId ? { parentId } : {}) });
    const args = (mode === "debug" ? configuration.debug?.args ?? [] : configuration.args ?? []).map((arg) => substituteRunTokens(arg, context));
    const env = Object.fromEntries(Object.entries(configuration.env ?? {}).map(([key, value]) => [key, substituteRunTokens(value, context)]));

    let handle: ProcessHandle;
    try {
      handle = await this.processes.start({
        id: entry.session.id,
        command: configuration.command,
        args,
        cwd: substituteRunTokens(configuration.cwd, context),
        env,
        onOutput: (chunk) => this.options.onOutput?.({ sessionId: entry.session.id, ...chunk }),
      });
    } catch (error) {
      return this.settle(entry, { state: "FAILED", failure: error instanceof Error ? error.message : String(error) });
    }
    entry.handle = handle;
    entry.session = { ...entry.session, pid: handle.pid };

    if (configuration.healthcheck && !(await waitForHealthy(configuration, substituteRunTokens(configuration.healthcheck.target, context)))) {
      await this.processes.stop(handle, configuration.shutdownTimeoutMs).catch(() => undefined);
      return this.settle(entry, { state: "FAILED", failure: "healthcheck did not pass before its timeout" });
    }
    return this.settle(entry, { state: "RUNNING" });
  }

  private track(configuration: ResolvedRunConfiguration, mode: RunMode, extra: { ports: readonly RunPort[]; parentId?: string }): Tracked {
    this.sequence += 1;
    const id = `run-${configuration.id}-${this.sequence}`;
    const session: RunSession = {
      id,
      configurationId: configuration.id,
      mode,
      state: "STARTING",
      startedAt: (this.options.now?.() ?? new Date()).toISOString(),
      ports: extra.ports,
      ...(extra.parentId ? { parentId: extra.parentId } : {}),
    };
    const entry: Tracked = { session, memberSessionIds: [], ...(configuration.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: configuration.shutdownTimeoutMs }) };
    this.tracked.set(id, entry);
    this.options.onSession?.(session);
    return entry;
  }

  private settle(entry: Tracked, patch: Partial<RunSession>): RunSession {
    entry.session = { ...entry.session, ...patch };
    if (entry.session.state === "STOPPED" || entry.session.state === "FAILED") entry.session.endedAt = (this.options.now?.() ?? new Date()).toISOString();
    this.options.onSession?.(entry.session);
    return entry.session;
  }

  private async stopEntry(entry: Tracked, byUser: boolean): Promise<RunSession> {
    if (entry.session.state === "STOPPED" || entry.session.state === "FAILED") return entry.session;
    this.settle(entry, { state: "STOPPING" });
    await this.stopMembers(entry);
    if (entry.handle) {
      const evidence = await this.processes.stop(entry.handle, entry.shutdownTimeoutMs);
      return this.settle(entry, { state: "STOPPED", exitCode: evidence.exitCode ?? null, stoppedByUser: byUser });
    }
    return this.settle(entry, { state: "STOPPED", stoppedByUser: byUser });
  }

  /** Reverse order: a client started after its backend is torn down before it,
      so nothing spends its last seconds talking to a socket that just closed. */
  private async stopMembers(entry: Tracked): Promise<void> {
    for (const memberId of [...entry.memberSessionIds].reverse()) {
      const member = this.tracked.get(memberId);
      if (member) await this.stopEntry(member, false);
    }
  }
}

function leavesOf(catalog: readonly ResolvedRunConfiguration[], configuration: ResolvedRunConfiguration): readonly ResolvedRunConfiguration[] {
  if (configuration.kind !== "compound") return [configuration];
  return (configuration.members ?? []).flatMap((memberId) => {
    const member = catalog.find((candidate) => candidate.id === memberId);
    return member ? leavesOf(catalog, member) : [];
  });
}

function declaredPorts(configuration: ResolvedRunConfiguration, mode: RunMode): readonly RunPort[] {
  const declared = configuration.ports ?? [];
  if (mode !== "debug" || !configuration.debug) return declared;
  return [...declared, { name: `${configuration.id}-debug`, port: configuration.debug.port, protocol: "tcp", bind: "loopback" }];
}

function portsOf(configuration: ResolvedRunConfiguration, mode: RunMode): readonly number[] {
  return declaredPorts(configuration, mode).map((port) => port.port);
}

async function waitForHealthy(configuration: ResolvedRunConfiguration, target: string): Promise<boolean> {
  const healthcheck = configuration.healthcheck;
  if (!healthcheck) return true;
  const deadline = Date.now() + healthcheck.timeoutMs;
  /** A service is not healthy the instant it is spawned, so the check is a
      wait with a deadline rather than a single verdict taken too early. */
  while (Date.now() < deadline) {
    if (await probeOnce(healthcheck.type, target, configuration)) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return false;
}

async function probeOnce(type: "http" | "command", target: string, configuration: ResolvedRunConfiguration): Promise<boolean> {
  if (type === "http") {
    return fetch(target, { signal: AbortSignal.timeout(1_000) }).then((response) => response.ok).catch(() => false);
  }
  if (!target.trim()) return false;
  // `target` is a command line, not an argv array. Keeping it intact lets the
  // platform shell handle quoted arguments and executable paths containing
  // spaces (a common Windows layout under Program Files).
  const command = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", target] : ["-lc", target];
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: configuration.cwd, env: { ...process.env, ...configuration.env }, stdio: "ignore", shell: false });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}
