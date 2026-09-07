import { readFile } from "node:fs/promises";
import type { ResolvedRunConfiguration, RunConfiguration, RunPort } from "../../domain/run-configuration.js";
import type { ServiceDefinition } from "./service-manager.js";

/** Every rejection names the configuration and the field, because a run
    configuration fails while the operator is looking somewhere else -- at the
    application they expected to start. */
export class RunConfigurationError extends Error {
  constructor(public readonly configurationId: string, public readonly field: string, message: string) {
    super(`${configurationId}: ${message}`);
    this.name = "RunConfigurationError";
  }
}

export async function loadRunConfigurations(path: string, services: readonly ServiceDefinition[] = []): Promise<readonly ResolvedRunConfiguration[]> {
  const text = await readFile(path, "utf8");
  const value = JSON.parse(text) as { configurations?: RunConfiguration[] };
  if (!Array.isArray(value.configurations)) throw new Error("Run configuration file must contain a configurations array");
  return resolveRunConfigurations(value.configurations, services);
}

export function resolveRunConfigurations(configurations: readonly RunConfiguration[], services: readonly ServiceDefinition[] = []): readonly ResolvedRunConfiguration[] {
  const ids = new Set<string>();
  for (const configuration of configurations) {
    if (!configuration.id) throw new RunConfigurationError("<unnamed>", "id", "a configuration requires an id");
    if (ids.has(configuration.id)) throw new RunConfigurationError(configuration.id, "id", "duplicate configuration id");
    ids.add(configuration.id);
  }
  const resolved = configurations.map((configuration) => resolveOne(configuration, services));
  for (const configuration of resolved) assertMembersResolve(configuration, resolved, []);
  return resolved;
}

function resolveOne(configuration: RunConfiguration, services: readonly ServiceDefinition[]): ResolvedRunConfiguration {
  const { id, kind, label } = configuration;
  if (!label) throw new RunConfigurationError(id, "label", "a configuration requires a label");
  if (kind !== "command" && kind !== "service" && kind !== "compound") throw new RunConfigurationError(id, "kind", `unknown kind: ${String(kind)}`);
  assertNoSecretEnv(configuration);
  for (const port of configuration.ports ?? []) assertPort(id, port);
  if (configuration.debug) {
    assertPortNumber(id, "debug.port", configuration.debug.port);
    if (!configuration.debug.args?.length) throw new RunConfigurationError(id, "debug.args", "debug mode requires the arguments that make the process debuggable");
  }

  if (kind === "compound") {
    if (configuration.command) throw new RunConfigurationError(id, "command", "a compound configuration starts its members, not a command of its own");
    if (!configuration.members?.length) throw new RunConfigurationError(id, "members", "a compound configuration requires members");
    return configuration;
  }

  if (kind === "command") {
    if (!configuration.command) throw new RunConfigurationError(id, "command", "a command configuration requires a command");
    if (!configuration.cwd) throw new RunConfigurationError(id, "cwd", "a command configuration requires a cwd");
    return configuration;
  }

  if (!configuration.service) throw new RunConfigurationError(id, "service", "a service configuration requires the id of a declared service");
  const service = services.find((candidate) => candidate.id === configuration.service);
  if (!service) throw new RunConfigurationError(id, "service", `no service declared with id ${configuration.service}`);
  /** Only additive fields may travel with the configuration: a copied command
      is two declarations of one process, and they drift. */
  if (configuration.command || configuration.args || configuration.cwd) {
    throw new RunConfigurationError(id, "service", "a service configuration inherits command, args and cwd instead of restating them");
  }
  const shutdownTimeoutMs = configuration.shutdownTimeoutMs ?? service.shutdownTimeoutMs;
  return {
    ...configuration,
    command: service.command,
    cwd: service.cwd,
    env: { ...service.env, ...configuration.env },
    ports: configuration.ports ?? [],
    ...(service.args ? { args: service.args } : {}),
    ...(shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs }),
  };
}

function assertMembersResolve(configuration: ResolvedRunConfiguration, catalog: readonly ResolvedRunConfiguration[], seen: readonly string[]): void {
  if (configuration.kind !== "compound") return;
  if (seen.includes(configuration.id)) throw new RunConfigurationError(configuration.id, "members", `members form a cycle: ${[...seen, configuration.id].join(" → ")}`);
  for (const memberId of configuration.members ?? []) {
    const member = catalog.find((candidate) => candidate.id === memberId);
    if (!member) throw new RunConfigurationError(configuration.id, "members", `no configuration declared with id ${memberId}`);
    assertMembersResolve(member, catalog, [...seen, configuration.id]);
  }
}

function assertNoSecretEnv(configuration: RunConfiguration): void {
  const secretLike = Object.keys(configuration.env ?? {}).find((key) => /token|secret|password|key/i.test(key));
  if (secretLike) throw new RunConfigurationError(configuration.id, "env", `secret-like environment key is not allowed: ${secretLike}`);
}

function assertPort(id: string, port: RunPort): void {
  assertPortNumber(id, "ports", port.port);
  if (port.protocol !== "http" && port.protocol !== "tcp") throw new RunConfigurationError(id, "ports", `unknown port protocol: ${String(port.protocol)}`);
  if (port.bind !== "loopback" && port.bind !== "all") throw new RunConfigurationError(id, "ports", `unknown bind: ${String(port.bind)}`);
}

function assertPortNumber(id: string, field: string, port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new RunConfigurationError(id, field, `port out of range: ${String(port)}`);
}

/** `${projectRoot}` and `${port:<name>}` keep a compound from stating the same
    port twice -- once where it is bound and once where a sibling calls it. */
export function substituteRunTokens(value: string, context: { projectRoot: string; ports: ReadonlyMap<string, number> }): string {
  return value
    .replaceAll("${projectRoot}", context.projectRoot)
    .replaceAll(/\$\{port:([^}]+)\}/g, (match, name: string) => {
      const port = context.ports.get(name);
      return port === undefined ? match : String(port);
    });
}

export function declaredPortsByName(catalog: readonly ResolvedRunConfiguration[]): ReadonlyMap<string, number> {
  const ports = new Map<string, number>();
  for (const configuration of catalog) {
    for (const port of configuration.ports ?? []) {
      if (port.name) ports.set(port.name, port.port);
    }
  }
  return ports;
}
