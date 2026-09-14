/** Domain shapes for the `database-schema-browser` module, matching the closed contract in
    SPEC-database-schema-browser.md#connection-and-schema-contract exactly. This file carries types
    only, no I/O: the round-trip of `DatabaseConnection[]` against `.ade/database-connections.json`
    lives in `src/adapters/database-connection-store.ts`, and the introspection subprocess (Phase 2)
    will live under `src/application/local-runtime/`, the same split `http-request.ts` and
    `bruno-collection-store.ts` already draw for the sibling `http-client` module.

    `DatabaseConnection` deliberately has no field for a password or any other secret — see the
    Product contract: authentication is delegated entirely to the native client's own mechanism
    (`.pgpass`/`PGPASSWORD` for `psql`, `~/.my.cnf`/`--defaults-extra-file` for `mysql`, none for
    `sqlite3`). `tests/database-schema.test.ts` asserts this at the type level, not just by
    omission here, so a future edit that reintroduces one fails `tsc --noEmit` (`npm run build`). */

export type DatabaseEngine = "postgres" | "mysql" | "sqlite";

export type DatabaseConnection = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host?: string; // postgres/mysql
  port?: number; // postgres/mysql
  database?: string; // postgres/mysql: database name; not applicable to sqlite
  user?: string; // postgres/mysql
  filePath?: string; // sqlite: path to the .db/.sqlite file
};

export type SchemaColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  ordinalPosition: number;
};

export type SchemaForeignKey = {
  column: string;
  referencesTable: string;
  referencesColumn: string;
};

export type SchemaTable = {
  name: string;
  kind: "table" | "view";
  columns: readonly SchemaColumn[];
  foreignKeys: readonly SchemaForeignKey[];
  indexes: readonly { name: string; columns: readonly string[]; unique: boolean }[];
};

/** Not persisted beyond the panel's active session: every `Refresh` replaces the previous snapshot
    in the sidecar's memory. No history of introspections and no attribution to Task evidence in
    this cut — see the spec's Open Questions. */
export type SchemaSnapshot = {
  connectionId: string;
  fetchedAt: string;
  schemas: readonly { name: string; tables: readonly SchemaTable[] }[];
};

/** Reported when the native client an engine needs (`psql`/`mysql`/`sqlite3`) is missing from
    `PATH`, or when the client ran but the introspection itself failed — surfaced verbatim per
    Boundaries ("mostrar el comando real lanzado y, ante error, el mensaje nativo del cliente sin
    reescribirlo"), never intercepted or rewritten by Assay. */
export type ToolchainGap = {
  engine: DatabaseEngine;
  command: string; // "psql" | "mysql" | "sqlite3"
  error: "not-found" | "auth-failed" | "connection-failed";
  nativeMessage: string; // the client's own output, unedited
};
