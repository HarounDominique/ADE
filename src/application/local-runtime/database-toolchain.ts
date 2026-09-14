import { runtimeEnvironment } from "../../adapters/local-process.js";
import type { DatabaseEngine } from "../../domain/database-schema.js";
import { probe, type ToolchainStatus } from "./toolchain-inspection.js";

/** Detects whether the native client an engine needs (`psql`/`mysql`/`sqlite3`) is on `PATH`,
    reusing the exact read-only `--version` probe `inspectProjectToolchains` already applies to
    `npm`/`cargo`/`mvn`/etc. — see ADR-0038 ("orquestar el toolchain que el operador ya tiene, no
    empaquetarlo"), which this module reuses without modifying. Unlike `inspectProjectToolchains`,
    detection here is not conditioned on a manifest file being present: a declared connection is
    itself the signal that its engine's client is wanted, so all three clients are probed directly
    rather than only when some `pyproject.toml`-equivalent exists. */
const clientByEngine: Record<DatabaseEngine, { command: string; label: string }> = {
  postgres: { command: "psql", label: "PostgreSQL (psql)" },
  mysql: { command: "mysql", label: "MySQL (mysql)" },
  sqlite: { command: "sqlite3", label: "SQLite (sqlite3)" },
};

export async function detectDatabaseClient(engine: DatabaseEngine, cwd: string = process.cwd()): Promise<ToolchainStatus> {
  const client = clientByEngine[engine];
  return probe(client.command, client.label, client.command, ["--version"], client.command, cwd, runtimeEnvironment(undefined));
}

export async function detectDatabaseToolchains(cwd: string = process.cwd()): Promise<readonly ToolchainStatus[]> {
  return Promise.all((Object.keys(clientByEngine) as DatabaseEngine[]).map((engine) => detectDatabaseClient(engine, cwd)));
}
