import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parseRequest, stringifyRequest, parseEnvironment, stringifyEnvironment } from "@usebruno/filestore";
import type { HttpEnvironment, HttpRequest, BrunoRequestItem, BrunoEnvironmentVars } from "../domain/http-request.js";
import { brunoItemToRequest, brunoVarsToEnvironment, environmentToBrunoVars, requestToBrunoItem } from "../domain/http-request.js";

/** Reads and writes single `.bru` request/environment files under `.ade/http/` via
    `@usebruno/filestore`. Neither a request's nor an environment's identity (`id`/`name` for an
    environment) lives inside the file content — Bruno derives both from the filename — so this
    adapter is where the filename becomes the domain `id` (and, for environments, the `name`). */

const idFromPath = (filePath: string): string => basename(filePath, extname(filePath));

export async function readRequestFile(filePath: string): Promise<HttpRequest> {
  const content = await readFile(filePath, "utf8");
  const item = parseRequest(content, { format: "bru" }) as BrunoRequestItem;
  return brunoItemToRequest(item, idFromPath(filePath));
}

export async function writeRequestFile(filePath: string, request: HttpRequest): Promise<void> {
  const item = requestToBrunoItem(request);
  // `@usebruno/filestore`'s own published types reference `@usebruno/schema-types`, a devDependency
  // of that package it never lists as a runtime dependency for consumers — it isn't installed here
  // (nor does our BrunoRequestItem need to structurally match its full internal schema, only the
  // subset Phase 1 round-trips), so the call is typed through `any` at this one boundary.
  const content = stringifyRequest(item as any, { format: "bru" });
  await writeFile(filePath, content, "utf8");
}

export async function readEnvironmentFile(filePath: string): Promise<HttpEnvironment> {
  const content = await readFile(filePath, "utf8");
  const vars = parseEnvironment(content, { format: "bru" }) as BrunoEnvironmentVars;
  const name = idFromPath(filePath);
  return brunoVarsToEnvironment(vars, name, name);
}

export async function writeEnvironmentFile(filePath: string, environment: HttpEnvironment): Promise<void> {
  const vars = environmentToBrunoVars(environment);
  const content = stringifyEnvironment(vars as any, { format: "bru" });
  await writeFile(filePath, content, "utf8");
}
