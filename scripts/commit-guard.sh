#!/usr/bin/env bash
# Deterministic TDD commit guard.
# Exit 0: guard passes, commit may proceed.
# Exit 1: guard fails, print which check and why.
#
# Default detection is by filename, not by directory: a changed file counts as
# production code if it has a recognized source extension and its name does NOT match a
# test-naming pattern; it counts as a test if its name DOES match one. This works for a
# flat-root layout (wordcount.py + test_wordcount.py) exactly the same as src/+tests/ —
# no per-project glob edit required for the common case.
#
# Override only if this project's conventions genuinely don't fit (e.g. a non-standard
# test suffix): set PRODUCTION_EXTS / TEST_NAME_PATTERNS below, or export them before
# calling this script. Do not "fix" a false FAIL by loosening these per commit — fix the
# pattern once, here, if it's genuinely wrong for every commit, never for just this one.
#
# This project's Rust code (desktop/src-tauri) keeps tests inline in the same file as
# the code under test (`#[cfg(test)] mod tests` at the bottom of e.g. lib.rs) rather than
# in a separate *_test.rs/*.test.rs file — the idiomatic Rust convention, and genuinely
# incompatible with a purely filename-based test/production split. rs_file_has_new_test()
# below treats a staged .rs file as "test changed" when its diff adds a new `#[test]`,
# so it can satisfy the gate for itself instead of always tripping the "no test file"
# check for every Rust commit.
#
# Last test run: since an env var set by one Bash call does not survive into the next
# (each tool call is its own subprocess), the actual test verdict is read from a file,
# not an environment variable — write the real exit code to $SEED_LAST_TEST_RESULT_FILE
# (default memory-bank/.local/last-test-exit-code) right after running the suite, e.g.:
#   python -m pytest -q; echo $? > memory-bank/.local/last-test-exit-code

set -uo pipefail

PRODUCTION_EXTS="${PRODUCTION_EXTS:-py js ts jsx tsx go rs java rb php c cpp h hpp cs}"
# Matched against the filename (not the full path): test_*, *_test.*, *.test.*, *.spec.*
TEST_NAME_PATTERNS="${TEST_NAME_PATTERNS:-test_* *_test.* *.test.* *.spec.*}"
SEED_LAST_TEST_RESULT_FILE="${SEED_LAST_TEST_RESULT_FILE:-memory-bank/.local/last-test-exit-code}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "commit-guard: FAIL — not inside a git repository (run this from the project root, after \`git init\`)." >&2
  exit 1
fi

# name-status, not name-only: a deleted production file needs no new test — it needs
# nothing added at all, and treating a delete like an unguarded production edit blocks a
# perfectly normal cleanup commit for no TDD reason.
changed_status="$(git diff --cached --name-status)"

if [ -z "$changed_status" ]; then
  echo "commit-guard: nothing staged, nothing to check." >&2
  exit 0
fi

is_test_file() {
  local base
  base="$(basename "$1")"
  for pat in $TEST_NAME_PATTERNS; do
    # shellcheck disable=SC2053
    [[ "$base" == $pat ]] && return 0
  done
  return 1
}

is_production_file() {
  local base ext
  base="$(basename "$1")"
  ext="${base##*.}"
  [ "$ext" = "$base" ] && return 1  # no extension at all
  for e in $PRODUCTION_EXTS; do
    [ "$ext" = "$e" ] && ! is_test_file "$1" && return 0
  done
  return 1
}

rs_file_has_new_test() {
  case "$1" in
    *.rs) git diff --cached -- "$1" | grep -qE '^\+\s*#\[test\]' ;;
    *) return 1 ;;
  esac
}

production_changed=0
test_changed=0
production_files=""

while IFS=$'\t' read -r status f; do
  [ -z "$f" ] && continue
  if is_test_file "$f"; then
    test_changed=1
  elif rs_file_has_new_test "$f"; then
    test_changed=1
  elif [ "$status" != "D" ] && is_production_file "$f"; then
    production_changed=1
    production_files="$production_files$f\n"
  fi
done <<< "$changed_status"

if [ "$production_changed" -eq 1 ] && [ "$test_changed" -eq 0 ]; then
  echo "commit-guard: FAIL — production file(s) added/changed with no test file in this commit:" >&2
  printf '%b' "$production_files" >&2
  exit 1
fi

if [ -f "$SEED_LAST_TEST_RESULT_FILE" ]; then
  last_result="$(cat "$SEED_LAST_TEST_RESULT_FILE")"
  if [ "$last_result" != "0" ]; then
    echo "commit-guard: FAIL — last recorded test run exited non-zero (${last_result}), per ${SEED_LAST_TEST_RESULT_FILE}." >&2
    exit 1
  fi
else
  echo "commit-guard: FAIL — no recorded test result at ${SEED_LAST_TEST_RESULT_FILE}. Run the test suite and write its exit code there before committing (see this script's header)." >&2
  exit 1
fi

echo "commit-guard: PASS"
exit 0
