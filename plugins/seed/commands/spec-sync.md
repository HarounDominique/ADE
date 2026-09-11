---
description: Propagate a module spec edit to the nexus and every citing spec
argument-hint: <module-id>
---

# /seed:spec-sync — propagate a module spec change

Run after any edit to a module spec under a nexus. Automates
`${CLAUDE_PLUGIN_ROOT}/context/spec-first.md` § Keeping a multi-spec corpus in sync.

---

## Memory Bank Integration

**Precondition:** `memory-bank/` must exist — see `${CLAUDE_PLUGIN_ROOT}/context/preconditions.md`. Absent, run `/seed:init` first, say that you did, then continue.

**Reads from:** the changed `SPEC-<module-id>.md`, `SPEC-NEXUS.md`, every other
`SPEC-*.md` in the corpus.
**Updates:** `SPEC-NEXUS.md` (status, Blocked by, Change Log), any citing spec whose
citation needs correction or flagging.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`.

---

## Steps

1. Update the module's status in **both** places it exists — its own
   `SPEC-<module-id>.md` `Status:` field and its nexus row (status, `Blocked by` if the
   change resolved or introduced a blocker). One without the other is exactly the kind
   of half-applied propagation `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md`'s
   cross-document coherence lane exists to catch — do both here so there's nothing left
   to catch.
2. Search the corpus for the module id to find every citer.
3. For each `SPEC-<id>.md#<heading>` reference found, confirm the target heading still
   exists and still means what the citer assumed. Fix or flag drift inline at the
   citation site — never leave it silently pointing at a moved or changed heading.
4. If the change altered a boundary interface, propagate to every dependent module's
   spec, or flip that module to `blocked` with this module named in `Blocked by`.
5. Recompute readiness: any module whose `Blocked by` is now empty and whose
   dependencies are all `done` moves to `ready`.
6. Append one Change Log line to `SPEC-NEXUS.md`: date, module id, what changed, what
   propagated.
7. Commit every file this run touched (the module spec, `SPEC-NEXUS.md`, any citing spec
   fixed) on the current branch **now** — do not leave the propagation half-applied in
   the working tree for a later command to stumble on uncommitted. Commit message:
   `spec-sync: <module-id>`.

## When there is no nexus

Nothing to do — a single-spec project has no citers. Exit without writing anything.
