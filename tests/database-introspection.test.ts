import test from "node:test";
import assert from "node:assert/strict";
import type { ProcessEvidence, ProcessHandle, ProcessPort } from "../src/ports/process.js";
import { buildDatabaseIntrospectionCommand, introspectDatabaseSchema, parseDatabaseOutput } from "../src/application/local-runtime/database-introspection.js";
import type { DatabaseConnection } from "../src/domain/database-schema.js";

const connections: Record<DatabaseConnection["engine"], DatabaseConnection> = {
  postgres: { id: "pg", name: "Postgres", engine: "postgres", host: "db.example", port: 5433, database: "app", user: "reader" },
  mysql: { id: "my", name: "MySQL", engine: "mysql", host: "db.example", port: 3307, database: "app", user: "reader" },
  sqlite: { id: "sq", name: "SQLite", engine: "sqlite", filePath: "/tmp/app.sqlite" },
};

test("buildDatabaseIntrospectionCommand uses fixed native argv for every engine", () => {
  const postgres = buildDatabaseIntrospectionCommand(connections.postgres, "/project");
  assert.deepEqual(postgres.args.slice(0, 10), ["--csv", "--no-psqlrc", "--host", "db.example", "--port", "5433", "--username", "reader", "app", "-c"]);
  assert.match(postgres.args.at(-1) ?? "", /pg_catalog\.pg_class/);

  const mysql = buildDatabaseIntrospectionCommand(connections.mysql, "/project");
  assert.deepEqual(mysql.args.slice(0, 12), ["--batch", "--raw", "--skip-column-names", "--host", "db.example", "--port", "3307", "--username", "reader", "app", "-e", mysql.args.at(-1)]);
  assert.match(mysql.args.at(-1) ?? "", /information_schema\.columns/);

  const sqlite = buildDatabaseIntrospectionCommand(connections.sqlite, "/project");
  assert.equal(sqlite.command, "sqlite3");
  assert.deepEqual(sqlite.args.slice(0, 2), ["-json", "/tmp/app.sqlite"]);
  assert.match(sqlite.args.at(-1) ?? "", /pragma_table_info/);
});

test("parseDatabaseOutput folds CSV, TSV and sqlite JSON into the common schema tree", () => {
  const csv = [
    "schema_name,table_name,table_kind,column_name,data_type,is_nullable,is_primary_key,ordinal_position,fk_column,references_table,references_column,index_name,index_columns,index_unique",
    'public,orders,table,id,integer,NO,1,1,,,,,,',
    'public,orders,table,customer_id,integer,YES,0,2,customer_id,customers,id,orders_customer_idx,customer_id,0',
  ].join("\n");
  const postgres = parseDatabaseOutput(connections.postgres, csv);
  assert.equal(postgres.schemas[0]?.tables[0]?.name, "orders");
  assert.equal(postgres.schemas[0]?.tables[0]?.columns[0]?.isPrimaryKey, true);
  assert.equal(postgres.schemas[0]?.tables[0]?.columns[1]?.nullable, true);
  assert.deepEqual(postgres.schemas[0]?.tables[0]?.foreignKeys, [{ column: "customer_id", referencesTable: "customers", referencesColumn: "id" }]);
  assert.deepEqual(postgres.schemas[0]?.tables[0]?.indexes, [{ name: "orders_customer_idx", columns: ["customer_id"], unique: false }]);

  const mysql = parseDatabaseOutput(connections.mysql, "public\tusers\ttable\tname\tvarchar(30)\tNO\t0\t1\t\t\t\t\t\t\n");
  assert.equal(mysql.schemas[0]?.tables[0]?.columns[0]?.dataType, "varchar(30)");

  const sqlite = parseDatabaseOutput(connections.sqlite, JSON.stringify([{ schema_name: "main", table_name: "users", table_kind: "table", column_name: "id", data_type: "INTEGER", is_nullable: "NO", is_primary_key: "1", ordinal_position: 1 }]));
  assert.equal(sqlite.schemas[0]?.tables[0]?.columns[0]?.isPrimaryKey, true);
});

test("introspectDatabaseSchema returns a native authentication error without rewriting it", async () => {
  const processes: ProcessPort = new FakeProcess({
    id: "fake", state: "FAILED", exitCode: 2, signal: null, stdout: "", stderr: "psql: error: password authentication failed for user \"reader\"\n",
  });
  const result = await introspectDatabaseSchema(processes, connections.postgres, "/project");
  assert.deepEqual(result, { engine: "postgres", command: "psql", error: "auth-failed", nativeMessage: "psql: error: password authentication failed for user \"reader\"" });
});

test("introspectDatabaseSchema parses one successful sqlite process", async () => {
  const processes: ProcessPort = new FakeProcess({ id: "fake", state: "STOPPED", exitCode: 0, signal: null, stdout: "[{\"schema_name\":\"main\",\"table_name\":\"users\",\"table_kind\":\"table\",\"column_name\":\"id\",\"data_type\":\"INTEGER\",\"is_nullable\":\"NO\",\"is_primary_key\":\"1\",\"ordinal_position\":1}]", stderr: "" });
  const result = await introspectDatabaseSchema(processes, connections.sqlite, "/project");
  assert.equal("schemas" in result ? result.schemas[0]?.tables[0]?.name : undefined, "users");
});

class FakeProcess implements ProcessPort {
  constructor(private readonly evidence: ProcessEvidence) {}
  async start(definition: { onExit?: (evidence: ProcessEvidence) => void }): Promise<ProcessHandle> {
    queueMicrotask(() => definition.onExit?.(this.evidence));
    return { id: "fake", pid: 1, state: "RUNNING" };
  }
  async stop(): Promise<ProcessEvidence> { return this.evidence; }
}
