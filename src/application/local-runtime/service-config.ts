import { readFile } from "node:fs/promises";
import type { ServiceDefinition } from "./service-manager.js";

export async function loadServiceDefinitions(path: string): Promise<readonly ServiceDefinition[]> {
  const text = await readFile(path, "utf8");
  const value = JSON.parse(text) as { services?: ServiceDefinition[] };
  if (!Array.isArray(value.services)) throw new Error("Service configuration must contain a services array");
  return value.services.map((service) => {
    if (!service.id || !service.command || !service.cwd) throw new Error("Service requires id, command and cwd");
    if (service.env && Object.keys(service.env).some((key) => /token|secret|password|key/i.test(key))) throw new Error(`Secret-like environment key is not allowed: ${service.id}`);
    return service;
  });
}
