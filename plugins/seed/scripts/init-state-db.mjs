#!/usr/bin/env node
/* Creates or repairs the hot-cache SQLite database described in
 * context/memory-bank-schema.md.
 *
 * Never a truth source: safe to delete and re-run at any time. This only
 * derives the shape from the cold layer -- empty tables here, populated by the
 * commands that read and write each one during normal operation.
 *
 * Three ways in, tried in order, because the point is that this works on every
 * machine the plugin installs on rather than on the ones that happen to have a
 * database tool:
 *
 *   1. `node:sqlite`, the standard library. Present from Node 22.5, which is
 *      what makes this work on Windows without asking anyone to install
 *      anything -- Claude Code already brought the runtime.
 *   2. The `sqlite3` CLI, for an older Node.
 *   3. `python3`/`python` and its stdlib `sqlite3` module, for an older Node on
 *      a machine without the CLI.
 *
 * Usage: node init-state-db.mjs [db-path]
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const dbPath = process.argv[2] ?? join("memory-bank", ".local", "state.db");
mkdirSync(dirname(dbPath), { recursive: true });

/* Single quotes: in SQLite a double-quoted token is an identifier, and only a
   legacy fallback makes it behave as a string. A CHECK written with double
   quotes stops being enforced the moment that fallback is off. */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spec_index (
  module_id     TEXT PRIMARY KEY,
  spec_file     TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('draft','ready','blocked','in-progress','done')),
  depends_on    TEXT NOT NULL DEFAULT '',
  blocked_by    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phase_state (
  slug          TEXT NOT NULL,
  phase_number  INTEGER NOT NULL,
  step_number   INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL CHECK (status IN ('NOT_STARTED','RUNNING','DONE')),
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (slug, phase_number)
);

CREATE TABLE IF NOT EXISTS citations (
  source_spec    TEXT NOT NULL,
  source_heading TEXT NOT NULL,
  target_spec    TEXT NOT NULL,
  target_heading TEXT NOT NULL,
  resolved       INTEGER NOT NULL CHECK (resolved IN (0,1)),
  checked_at     TEXT NOT NULL,
  PRIMARY KEY (source_spec, source_heading, target_spec, target_heading)
);

CREATE TABLE IF NOT EXISTS learned_rules (
  rule_id         TEXT PRIMARY KEY,
  topic_file      TEXT NOT NULL,
  priority        TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  evidence_count  INTEGER NOT NULL DEFAULT 1,
  last_validated  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spec_index_status ON spec_index(status);
CREATE INDEX IF NOT EXISTS idx_citations_resolved ON citations(resolved);
CREATE INDEX IF NOT EXISTS idx_learned_rules_topic ON learned_rules(topic_file);
`;

function viaNodeSqlite() {
  try {
    /* Dynamic: an older Node has no such module, and that is a fallback rather
       than a crash. */
    const { DatabaseSync } = process.getBuiltinModule
      ? process.getBuiltinModule("node:sqlite")
      : {};
    if (!DatabaseSync) return false;
    const db = new DatabaseSync(dbPath);
    db.exec(SCHEMA_SQL);
    db.close();
    return "node:sqlite (standard library)";
  } catch {
    return false;
  }
}

function viaSqliteCli() {
  const probe = spawnSync("sqlite3", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) return false;
  const run = spawnSync("sqlite3", [dbPath], { input: SCHEMA_SQL, encoding: "utf8" });
  return run.status === 0 ? "the sqlite3 CLI" : false;
}

function viaPython() {
  /* Windows ships a python3/python shim that exists on PATH but only opens the
     Microsoft Store when run. `--version` succeeding is what tells them apart,
     not mere presence. */
  const interpreter = ["python3", "python"].find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
  if (!interpreter) return false;
  const scriptFile = join(tmpdir(), `seed-init-db-${process.pid}.py`);
  try {
    writeFileSync(scriptFile, "import sqlite3, sys\nconn = sqlite3.connect(sys.argv[1])\nconn.executescript(sys.argv[2])\nconn.commit()\nconn.close()\n", "utf8");
    const run = spawnSync(interpreter, [scriptFile, dbPath, SCHEMA_SQL], { encoding: "utf8" });
    return run.status === 0 ? `'${interpreter}' and its stdlib sqlite3` : false;
  } finally {
    rmSync(scriptFile, { force: true });
  }
}

const how = viaNodeSqlite() || viaSqliteCli() || viaPython();

if (!how) {
  console.error(
    "no way to create the hot cache: this Node has no node:sqlite, there is no sqlite3 CLI, " +
    "and no working python3/python was found. Upgrade Node to 22.5 or later, or install either " +
    "of the others, then re-run. This is a missing prerequisite, not a silent skip.",
  );
  process.exit(1);
}

console.log(`hot cache ready at ${dbPath} via ${how} (rebuild any time: delete it and re-run this script)`);
