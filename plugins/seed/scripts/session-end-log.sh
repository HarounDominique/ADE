#!/usr/bin/env bash
# SessionEnd hook: reads the hook JSON from stdin (session_id, transcript_path, cwd,
# hook_event_name, reason) and writes one small log entry under
# memory-bank/.local/session-logs/<session_id>.md — hot cache, gitignored, never a
# truth source. /seed:reflect reads these as optional corroborating evidence, never as
# the only source for a claim.
#
# Fails silently on any missing piece — a hook must never break the session it's
# attached to. No telemetry, no external send, purely local.

set -uo pipefail

find_working_python() {
  for candidate in python3 python; do
    if "$candidate" --version >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PY="$(find_working_python)" || exit 0

INPUT="$(cat)"

# The Python code and the JSON payload can't both go to the same stdin — write the code
# to a temp file and pass the JSON as its stdin instead (a heredoc plus a here-string on
# the same command silently drops the first one; the JSON parse then fails on garbage
# and the hook does nothing, with no visible error).
SCRIPT_FILE="$(mktemp)"
trap 'rm -f "$SCRIPT_FILE"' EXIT

cat > "$SCRIPT_FILE" <<'PYEOF'
import json
import os
import sys
from datetime import datetime, timezone

try:
    data = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)

cwd = data.get("cwd")
session_id = data.get("session_id")
reason = data.get("reason", "unknown")
transcript_path = data.get("transcript_path", "")

if not cwd or not session_id:
    sys.exit(0)

memory_bank = os.path.join(cwd, "memory-bank")
if not os.path.isdir(memory_bank):
    # Not a SEED-initialized project (or /seed:init hasn't run yet) — nothing to log.
    sys.exit(0)

log_dir = os.path.join(memory_bank, ".local", "session-logs")
os.makedirs(log_dir, exist_ok=True)

log_path = os.path.join(log_dir, f"{session_id}.md")
timestamp = datetime.now(timezone.utc).isoformat()

with open(log_path, "w", encoding="utf-8") as f:
    f.write(f"# Session log: {session_id}\n\n")
    f.write(f"- ended_at: {timestamp}\n")
    f.write(f"- reason: {reason}\n")
    f.write(f"- transcript_path: {transcript_path}\n")
PYEOF

printf '%s' "$INPUT" | "$PY" "$SCRIPT_FILE"

exit 0
