import crossSpawn from "cross-spawn";
import type { ProcessHandle, ProcessPort } from "../../ports/process.js";

export type ServiceDefinition = {
  id: string;
  command: string;
  args?: readonly string[];
  cwd: string;
  env?: Record<string, string>;
  healthcheck?: { command: string; args?: readonly string[]; timeoutMs?: number };
  shutdownTimeoutMs?: number;
};

export type ServiceStatus = "DECLARED" | "RUNNING" | "FAILED" | "STOPPED";

export class ServiceManager {
  private readonly services = new Map<string, { definition: ServiceDefinition; handle: ProcessHandle; status: ServiceStatus }>();

  constructor(private readonly processes: ProcessPort) {}

  async start(definition: ServiceDefinition): Promise<ServiceStatus> {
    if (this.services.has(definition.id)) return this.services.get(definition.id)?.status ?? "FAILED";
    const handle = await this.processes.start(definition);
    if (definition.healthcheck && !(await runHealthcheck(definition))) {
      await this.processes.stop(handle, definition.shutdownTimeoutMs);
      this.services.set(definition.id, { definition, handle, status: "FAILED" });
      return "FAILED";
    }
    this.services.set(definition.id, { definition, handle, status: "RUNNING" });
    return "RUNNING";
  }

  async stop(id: string): Promise<ServiceStatus> {
    const service = this.services.get(id);
    if (!service) return "STOPPED";
    await this.processes.stop(service.handle, service.definition.shutdownTimeoutMs);
    service.status = "STOPPED";
    return service.status;
  }

  status(id: string): ServiceStatus {
    return this.services.get(id)?.status ?? "DECLARED";
  }
}

async function runHealthcheck(definition: ServiceDefinition): Promise<boolean> {
  const healthcheck = definition.healthcheck;
  if (!healthcheck) return true;
  return new Promise((resolve) => {
    const child = crossSpawn(healthcheck.command, [...(healthcheck.args ?? [])], { windowsHide: true, cwd: definition.cwd, env: { ...process.env, ...definition.env }, stdio: "ignore" });
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(false); }, healthcheck.timeoutMs ?? 2_000);
    child.once("error", () => { clearTimeout(timer); resolve(false); });
    child.once("close", (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}
