import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DatabaseConnection, DatabaseEngine } from "../domain/database-schema.js";

/** Reads and writes `.ade/database-connections.json` — a top-level array, versioned with the
    repository, in the same spirit as `.ade/run.json` and `.ade/services.json`. Unlike those two,
    this file has no wrapping object key: the Product contract calls it "un array versionable con
    el repositorio" directly, so `loadDatabaseConnections`/`saveDatabaseConnections` read and write
    the array itself rather than a `{ connections: [...] }` envelope.

    Every entry is rebuilt field-by-field here rather than passed through — on both load (from
    parsed JSON) and save (from the caller's in-memory objects) — so a `password` key can never
    round-trip through this store even if one slipped onto a `DatabaseConnection` value at runtime
    despite the type forbidding it (see `tests/database-schema.test.ts`). That is what actually
    backs the acceptance criterion "nunca incluye un campo de contraseña, ni siquiera vacío": the
    type check alone would not catch a value built by spreading an untrusted object. */

/** A Project with no `.ade/database-connections.json` yet has no declared connections, not an
    error — mirrors `listHttpCollectionTree`'s empty-tree-for-a-missing-directory behavior, and the
    acceptance criterion that an existing file "lista sus conexiones sin requerir conversión". */
export async function loadDatabaseConnections(path: string): Promise<readonly DatabaseConnection[]> {
  const text = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "[]";
    throw error;
  });
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new Error("database-connections.json must contain a top-level array");
  return value.map((entry) => toConnection(entry));
}

export async function saveDatabaseConnections(path: string, connections: readonly DatabaseConnection[]): Promise<void> {
  const sanitized = connections.map((connection) => toConnection(connection));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
}

const engines: readonly DatabaseEngine[] = ["postgres", "mysql", "sqlite"];

function toConnection(entry: unknown): DatabaseConnection {
  const raw = entry as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id) throw new Error("a database connection requires an id");
  if (typeof raw.name !== "string" || !raw.name) throw new Error(`${raw.id}: a database connection requires a name`);
  if (!engines.includes(raw.engine as DatabaseEngine)) throw new Error(`${raw.id}: unknown engine: ${String(raw.engine)}`);
  return {
    id: raw.id,
    name: raw.name,
    engine: raw.engine as DatabaseEngine,
    ...(typeof raw.host === "string" ? { host: raw.host } : {}),
    ...(typeof raw.port === "number" ? { port: raw.port } : {}),
    ...(typeof raw.database === "string" ? { database: raw.database } : {}),
    ...(typeof raw.user === "string" ? { user: raw.user } : {}),
    ...(typeof raw.filePath === "string" ? { filePath: raw.filePath } : {}),
  };
}
