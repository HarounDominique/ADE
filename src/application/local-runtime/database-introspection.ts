import type { ProcessEvidence, ProcessPort } from "../../ports/process.js";
import type { DatabaseConnection, DatabaseEngine, SchemaSnapshot, SchemaTable, ToolchainGap } from "../../domain/database-schema.js";

export type DatabaseCommand = { command: string; args: readonly string[]; cwd: string };

type MetadataRow = {
  schema_name?: string;
  table_name?: string;
  table_kind?: string;
  column_name?: string;
  data_type?: string;
  is_nullable?: string | number | boolean;
  is_primary_key?: string | number | boolean;
  ordinal_position?: string | number;
  fk_column?: string;
  references_table?: string;
  references_column?: string;
  index_name?: string;
  index_columns?: string;
  index_unique?: string | number | boolean;
};

/** The three native clients receive one fixed catalogue query. No caller supplied SQL is ever
    accepted here; connection fields only select the client and its standard connection argv. */
export function buildDatabaseIntrospectionCommand(connection: DatabaseConnection, cwd: string): DatabaseCommand {
  const query = queryFor(connection.engine);
  switch (connection.engine) {
    case "postgres":
      return { command: "psql", cwd, args: ["--csv", "--no-psqlrc", ...hostArgs(connection), ...databaseArgs(connection), "-c", query] };
    case "mysql":
      return { command: "mysql", cwd, args: ["--batch", "--raw", "--skip-column-names", ...hostArgs(connection), ...databaseArgs(connection), "-e", query] };
    case "sqlite":
      if (!connection.filePath) throw new Error(`${connection.id}: sqlite connections require filePath`);
      return { command: "sqlite3", cwd, args: ["-json", connection.filePath, query] };
  }
}

/** Executes exactly one native client process. A client that tries to wait for an interactive
    password prompt is terminated after the same bounded window as a failed connection, so the
    sidecar never becomes stuck behind a prompt it cannot satisfy. */
export async function introspectDatabaseSchema(processes: ProcessPort, connection: DatabaseConnection, cwd: string, timeoutMs = 15_000): Promise<SchemaSnapshot | ToolchainGap> {
  const definition = buildDatabaseIntrospectionCommand(connection, cwd);
  let handleId: string | undefined;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveExit!: (evidence: ProcessEvidence) => void;
  let rejectStart!: (error: unknown) => void;
  const exited = new Promise<ProcessEvidence>((resolve) => { resolveExit = resolve; });
  const started = new Promise<void>((resolve, reject) => { rejectStart = reject; void processes.start({
    id: `database-schema-${connection.id}-${Date.now()}`,
    command: definition.command,
    args: definition.args,
    cwd: definition.cwd,
    onExit: resolveExit,
  }).then((handle) => { handleId = handle.id; resolve(); }).catch(reject); });
  try {
    await started;
    const evidence = await Promise.race([
      exited,
      new Promise<ProcessEvidence>((resolve) => {
        timer = setTimeout(async () => {
          if (!handleId || settled) return;
          settled = true;
          resolve(await processes.stop({ id: handleId, pid: -1, state: "RUNNING" }));
        }, timeoutMs);
      }),
    ]);
    settled = true;
    if (timer) clearTimeout(timer);
    if (evidence.state !== "STOPPED" || (evidence.exitCode ?? 1) !== 0) return databaseGap(connection, definition.command, evidence);
    return parseDatabaseOutput(connection, evidence.stdout);
  } catch (error) {
    if (timer) clearTimeout(timer);
    const nativeMessage = error instanceof Error ? error.message : String(error);
    return { engine: connection.engine, command: definition.command, error: /ENOENT|not found|cannot find/i.test(nativeMessage) ? "not-found" : "connection-failed", nativeMessage };
  } finally {
    rejectStart = () => {};
  }
}

export function parseDatabaseOutput(connection: DatabaseConnection, output: string): SchemaSnapshot {
  const rows = connection.engine === "sqlite" ? parseJsonRows(output) : connection.engine === "postgres" ? parseCsvRows(output) : parseTsvRows(output);
  return snapshotFromRows(connection.id, rows);
}

function databaseGap(connection: DatabaseConnection, command: string, evidence: ProcessEvidence): ToolchainGap {
  const nativeMessage = `${evidence.stderr}${evidence.stdout}`.trim();
  return {
    engine: connection.engine,
    command,
    error: /password|authentication|access denied|login failed/i.test(nativeMessage) ? "auth-failed" : "connection-failed",
    nativeMessage,
  };
}

function snapshotFromRows(connectionId: string, rows: readonly MetadataRow[]): SchemaSnapshot {
  const schemas = new Map<string, Map<string, SchemaTable>>();
  for (const row of rows) {
    const schemaName = row.schema_name ?? "main";
    const tableName = row.table_name;
    if (!tableName) continue;
    const tables = schemas.get(schemaName) ?? new Map<string, SchemaTable>();
    const existing = tables.get(tableName);
    const columns = existing?.columns ? [...existing.columns] : [];
    if (row.column_name && !columns.some((column) => column.name === row.column_name)) columns.push({
      name: row.column_name,
      dataType: row.data_type ?? "",
      nullable: !truthy(row.is_nullable) || String(row.is_nullable).toUpperCase() === "YES" || String(row.is_nullable).toLowerCase() === "true",
      isPrimaryKey: truthy(row.is_primary_key),
      ordinalPosition: number(row.ordinal_position, columns.length + 1),
    });
    const foreignKeys = existing?.foreignKeys ? [...existing.foreignKeys] : [];
    if (row.fk_column && row.references_table && row.references_column && !foreignKeys.some((key) => key.column === row.fk_column && key.referencesTable === row.references_table && key.referencesColumn === row.references_column)) foreignKeys.push({ column: row.fk_column, referencesTable: row.references_table, referencesColumn: row.references_column });
    const indexes = existing?.indexes ? [...existing.indexes] : [];
    if (row.index_name) {
      const index = indexes.find((candidate) => candidate.name === row.index_name);
      const newColumns = (row.index_columns ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      if (index) {
        index.columns = [...index.columns, ...newColumns.filter((column) => !index.columns.includes(column))];
      } else indexes.push({ name: row.index_name, columns: newColumns, unique: truthy(row.index_unique) });
    }
    tables.set(tableName, { name: tableName, kind: row.table_kind === "view" ? "view" : existing?.kind ?? "table", columns, foreignKeys, indexes });
    schemas.set(schemaName, tables);
  }
  return { connectionId, fetchedAt: new Date().toISOString(), schemas: [...schemas.entries()].map(([name, tables]) => ({ name, tables: [...tables.values()].map((table) => ({ ...table, columns: [...table.columns].sort((a, b) => a.ordinalPosition - b.ordinalPosition) })) })) };
}

function parseCsvRows(output: string): MetadataRow[] {
  const records = output.trim() ? output.trim().split(/\r?\n/).map(parseCsvLine) : [];
  if (!records.length) return [];
  const headers = records.shift()!;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))) as MetadataRow[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value); value = ""; }
    else value += character;
  }
  values.push(value);
  return values;
}

function parseTsvRows(output: string): MetadataRow[] {
  const lines = output.trim() ? output.trim().split(/\r?\n/) : [];
  return lines.map((line) => {
    const [schema_name, table_name, table_kind, column_name, data_type, is_nullable, is_primary_key, ordinal_position, fk_column, references_table, references_column, index_name, index_columns, index_unique] = line.split("\t");
    return { schema_name, table_name, table_kind, column_name, data_type, is_nullable, is_primary_key, ordinal_position, fk_column, references_table, references_column, index_name, index_columns, index_unique } as MetadataRow;
  });
}

function parseJsonRows(output: string): MetadataRow[] {
  if (!output.trim()) return [];
  const value: unknown = JSON.parse(output);
  if (!Array.isArray(value)) throw new Error("sqlite3 introspection output must be a JSON array");
  return value.filter((row): row is MetadataRow => Boolean(row && typeof row === "object"));
}

function truthy(value: unknown): boolean { return value === true || value === 1 || value === "1" || /^(yes|true|t)$/i.test(String(value ?? "")); }
function number(value: unknown, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

function hostArgs(connection: DatabaseConnection): string[] { return connection.host ? ["--host", connection.host, ...(connection.port ? ["--port", String(connection.port)] : [])] : []; }
function databaseArgs(connection: DatabaseConnection): string[] { return connection.engine === "sqlite" ? [] : [ ...(connection.user ? ["--username", connection.user] : []), ...(connection.database ? [connection.database] : []) ]; }

const queryFor = (engine: DatabaseEngine): string => engine === "postgres" ? postgresQuery : engine === "mysql" ? mysqlQuery : sqliteQuery;

// Each query emits the same 14 fields. Repeated table rows carry different metadata facets; the
// parser folds them into one common snapshot without reading user data.
const postgresQuery = `SELECT * FROM (SELECT n.nspname AS schema_name,c.relname AS table_name,CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS table_kind,a.attname AS column_name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey)) THEN '1' ELSE '0' END AS is_primary_key,a.attnum AS ordinal_position,NULL::text AS fk_column,NULL::text AS references_table,NULL::text AS references_column,NULL::text AS index_name,NULL::text AS index_columns,NULL::text AS index_unique FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE c.relkind IN ('r','v') AND n.nspname NOT IN ('pg_catalog','information_schema') UNION ALL SELECT n.nspname,c.relname,CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,src.attname,ref.relname,refatt.attname,NULL,NULL,NULL FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS sk(attnum,position) ON true JOIN pg_attribute src ON src.attrelid=c.oid AND src.attnum=sk.attnum JOIN pg_class ref ON ref.oid=con.confrelid JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum,position) ON rk.position=sk.position JOIN pg_attribute refatt ON refatt.attrelid=ref.oid AND refatt.attnum=rk.attnum WHERE con.contype='f' AND n.nspname NOT IN ('pg_catalog','information_schema') UNION ALL SELECT n.nspname,c.relname,CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,idx.relname,string_agg(att.attname,',' ORDER BY array_position(i.indkey,att.attnum)),CASE WHEN i.indisunique THEN '1' ELSE '0' END FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN LATERAL unnest(i.indkey) key(attnum) ON true JOIN pg_attribute att ON att.attrelid=c.oid AND att.attnum=key.attnum WHERE NOT i.indisprimary AND n.nspname NOT IN ('pg_catalog','information_schema') GROUP BY n.nspname,c.relname,c.relkind,idx.relname,i.indisunique) metadata ORDER BY schema_name,table_name,ordinal_position NULLS LAST`;
const mysqlQuery = `SELECT * FROM (SELECT table_schema AS schema_name,table_name,CASE WHEN table_type='VIEW' THEN 'view' ELSE 'table' END AS table_kind,column_name,column_type AS data_type,is_nullable,CASE WHEN column_key='PRI' THEN '1' ELSE '0' END AS is_primary_key,ordinal_position,NULL AS fk_column,NULL AS references_table,NULL AS references_column,NULL AS index_name,NULL AS index_columns,NULL AS index_unique FROM information_schema.columns WHERE table_schema=DATABASE() UNION ALL SELECT kcu.table_schema,kcu.table_name,CASE WHEN tc.table_type='VIEW' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,kcu.column_name,kcu.referenced_table_name,kcu.referenced_column_name,NULL,NULL,NULL FROM information_schema.key_column_usage kcu JOIN information_schema.tables tc ON tc.table_schema=kcu.table_schema AND tc.table_name=kcu.table_name WHERE kcu.table_schema=DATABASE() AND kcu.referenced_table_name IS NOT NULL UNION ALL SELECT s.table_schema,s.table_name,CASE WHEN t.table_type='VIEW' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,s.index_name,s.column_name,CASE WHEN s.non_unique=0 THEN '1' ELSE '0' END FROM information_schema.statistics s JOIN information_schema.tables t ON t.table_schema=s.table_schema AND t.table_name=s.table_name WHERE s.table_schema=DATABASE() AND s.index_name<>'PRIMARY') metadata ORDER BY schema_name,table_name,ordinal_position`;
const sqliteQuery = `SELECT * FROM (SELECT 'main' AS schema_name,m.name AS table_name,CASE WHEN m.type='view' THEN 'view' ELSE 'table' END AS table_kind,p.name AS column_name,p.type AS data_type,CASE WHEN p."notnull"=0 THEN 'YES' ELSE 'NO' END AS is_nullable,CASE WHEN p.pk>0 THEN '1' ELSE '0' END AS is_primary_key,p.cid+1 AS ordinal_position,NULL AS fk_column,NULL AS references_table,NULL AS references_column,NULL AS index_name,NULL AS index_columns,NULL AS index_unique FROM sqlite_master m JOIN pragma_table_info(m.name) p ON 1=1 WHERE m.type IN ('table','view') AND m.name NOT LIKE 'sqlite_%' UNION ALL SELECT 'main',m.name,CASE WHEN m.type='view' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,f.[from],f.[table],f.[to],NULL,NULL,NULL FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f ON 1=1 WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' UNION ALL SELECT 'main',m.name,CASE WHEN m.type='view' THEN 'view' ELSE 'table' END,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,i.name,ii.name,CASE WHEN i.[unique]=1 THEN '1' ELSE '0' END FROM sqlite_master m JOIN pragma_index_list(m.name) i ON 1=1 JOIN pragma_index_info(i.name) ii ON 1=1 WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' AND i.origin<>'pk') metadata ORDER BY schema_name,table_name,ordinal_position`;
