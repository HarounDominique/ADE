import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDatabaseConnections, saveDatabaseConnections } from "../src/adapters/database-connection-store.js";
import type { DatabaseConnection } from "../src/domain/database-schema.js";

const tempDir = () => mkdtemp(join(tmpdir(), "ade-db-connections-"));

const fixtures: readonly DatabaseConnection[] = [
  { id: "local-pg", name: "Local Postgres", engine: "postgres", host: "localhost", port: 5432, database: "app_dev", user: "app" },
  { id: "staging-mysql", name: "Staging MySQL", engine: "mysql", host: "db.staging.internal", port: 3306, database: "app", user: "readonly" },
  { id: "fixtures-db", name: "Fixtures", engine: "sqlite", filePath: "./fixtures/app.sqlite" },
];

test("database connections round-trip through .ade/database-connections.json", async () => {
  const directory = await tempDir();
  const path = join(directory, "database-connections.json");

  await saveDatabaseConnections(path, fixtures);
  const loaded = await loadDatabaseConnections(path);

  assert.deepEqual(loaded, fixtures);
});

test("a Project with an existing database-connections.json lists its connections without conversion", async () => {
  const directory = await tempDir();
  const path = join(directory, "database-connections.json");
  await writeFile(path, JSON.stringify(fixtures, null, 2), "utf8");

  const loaded = await loadDatabaseConnections(path);

  assert.deepEqual(loaded, fixtures);
});

test("loading a missing database-connections.json is an empty Project, not an error", async () => {
  const directory = await tempDir();
  const loaded = await loadDatabaseConnections(join(directory, "does-not-exist.json"));
  assert.deepEqual(loaded, []);
});

test("loading rejects a file whose top level is not an array", async () => {
  const directory = await tempDir();
  const path = join(directory, "database-connections.json");
  await writeFile(path, JSON.stringify({ connections: fixtures }), "utf8");

  await assert.rejects(loadDatabaseConnections(path), /must contain a top-level array/);
});

test("saving never writes a password field to disk, even if one is smuggled onto the in-memory object", async () => {
  const directory = await tempDir();
  const path = join(directory, "database-connections.json");
  const withSmuggledPassword = { ...fixtures[0], password: "hunter2" } as DatabaseConnection;

  await saveDatabaseConnections(path, [withSmuggledPassword]);
  const raw = await readFile(path, "utf8");

  assert.ok(!raw.includes("hunter2"), "a password value must never reach the file, plaintext or otherwise");
  assert.ok(!raw.includes("password"), "a password key must never reach the file");
  const loaded = await loadDatabaseConnections(path);
  assert.deepEqual(loaded, [fixtures[0]]);
});

test("loading rejects an entry with an unknown engine", async () => {
  const directory = await tempDir();
  const path = join(directory, "database-connections.json");
  await writeFile(path, JSON.stringify([{ id: "x", name: "X", engine: "oracle" }]), "utf8");

  await assert.rejects(loadDatabaseConnections(path), /unknown engine/);
});
