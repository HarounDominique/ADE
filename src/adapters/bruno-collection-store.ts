import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { parseRequest, stringifyRequest, parseEnvironment, stringifyEnvironment } from "@usebruno/filestore";
import type { HttpCollectionNode, HttpEnvironment, HttpRequest, BrunoRequestItem, BrunoEnvironmentVars } from "../domain/http-request.js";
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
  await mkdir(dirname(filePath), { recursive: true });
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
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

/** Recursively lists `rootDirectory` as an `HttpCollectionNode` tree. Generic over whatever
    directory it's given — the caller (the sidecar RPC handler) is the one that decides the root
    is `.ade/http/`; this function has no opinion about where collections live on disk, only how to
    read one once pointed at it. A missing root directory is a collection-less Project, not an
    error: it returns an empty tree rather than throwing, matching
    SPEC-http-client.md#product-contract's "Sin colecciones, Assay ofrece crear la primera". */
export async function listHttpCollectionTree(rootDirectory: string): Promise<readonly HttpCollectionNode[]> {
  return listDirectory(rootDirectory, "");
}

async function listDirectory(absoluteDirectory: string, relativePath: string): Promise<readonly HttpCollectionNode[]> {
  let entries;
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: HttpCollectionNode[] = [];
  const isEnvironmentFolder = basename(absoluteDirectory) === "environments";
  for (const entry of entries) {
    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const entryAbsolutePath = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      nodes.push({ type: "folder", name: entry.name, path: entryPath, children: await listDirectory(entryAbsolutePath, entryPath) });
    } else if (entry.isFile() && extname(entry.name) === ".bru") {
      if (isEnvironmentFolder) {
        const environment = await readEnvironmentFile(entryAbsolutePath);
        nodes.push({ type: "environment", id: environment.id, name: environment.name, path: entryPath });
      } else {
        const request = await readRequestFile(entryAbsolutePath);
        nodes.push({ type: "request", id: request.id, name: request.name, method: request.method, path: entryPath });
      }
    }
    // A non-.bru file (e.g. a stray .gitkeep) is skipped, not an error.
  }
  return nodes;
}
