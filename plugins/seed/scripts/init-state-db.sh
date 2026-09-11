#!/usr/bin/env bash
# Creates/repairs the hot-cache SQLite database described in
# context/memory-bank-schema.md. Never a truth source — safe to delete and re-run
# any time; this script only derives it from the cold layer's shape (empty tables here,
# populated by the commands that read/write each one during normal operation).
#
# Prefers the `sqlite3` CLI; falls back to `python3 -c "import sqlite3"` (stdlib, no
# install needed) when the CLI isn't on PATH — many dev machines have Python but not the
# sqlite3 binary, and the schema itself is identical either way.

set -euo pipefail

DB_PATH="${1:-memory-bank/.local/state.db}"
mkdir -p "$(dirname "$DB_PATH")"

SCHEMA_SQL="$(cat <<'SCHEMA_EOF'
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
SCHEMA_EOF
)"

find_working_python() {
  for candidate in python3 python; do
    if "$candidate" --version >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" <<SQL
$SCHEMA_SQL
SQL
  echo "hot cache ready at $DB_PATH via sqlite3 CLI (rebuild any time: rm it and re-run this script)"
elif PY="$(find_working_python)"; then
  # Windows ships a `python3`/`python` shim that "exists" per `command -v` but only
  # opens the Microsoft Store when actually run — --version above is what tells them apart.
  "$PY" - "$DB_PATH" "$SCHEMA_SQL" <<'PYEOF'
import sqlite3
import sys

db_path, schema_sql = sys.argv[1], sys.argv[2]
conn = sqlite3.connect(db_path)
conn.executescript(schema_sql)
conn.commit()
conn.close()
PYEOF
  echo "hot cache ready at $DB_PATH via '$PY' stdlib sqlite3 (sqlite3 CLI not found; rebuild any time: rm it and re-run this script)"
else
  echo "no sqlite3 CLI and no python3/python on PATH — cannot create hot cache. Install either, then re-run this script. This is a missing prerequisite, not a silent skip." >&2
  exit 1
fi
