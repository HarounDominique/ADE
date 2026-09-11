# Spec-first — the one mandatory origin

Every task's execution state starts at `spec`, never at `plan`. `/seed:plan` refuses to
run without a spec file it can point to. This is not a preference — it is the single
non-negotiable origin of the whole workflow: nothing downstream (plan, creative, build,
reflect, archive) is trusted unless it traces back to a spec document.

## Single capability

One `SPEC-<slug>.md` in `memory-bank/specs/`, covering:

1. **Objective** — what is being built, for whom, what success looks like.
2. **Commands** — the real, executable commands that build/test/lint it.
3. **Structure** — where the code, tests, and docs for this capability live.
4. **Style** — one real snippet in the target style beats a paragraph describing it.
5. **Test strategy** — framework, location, coverage expectation, test levels.
6. **Boundaries** — always-do / ask-first / never-do, three tiers, explicit.

Surface every assumption before writing the spec body, as a numbered list the human can
correct in one pass. Never silently fill an ambiguous requirement.

## Bundled capabilities → nexus spec first

If the request names more than one independently-testable capability, or more than one
distinct screen/view/menu, do not write a module spec yet. Propose `SPEC-NEXUS.md` first:

```markdown
# Nexus: <initiative name>

## Tech Foundations
[Stack, runtime versions, cross-cutting patterns every module inherits instead of
re-declaring. A module overrides this only with a documented reason.]

## Modules

| Module id | Spec file | Responsibility | Depends on | Status | Blocked by |
|---|---|---|---|---|---|
| <id> | SPEC-<id>.md | ... | — | draft \| ready \| blocked \| in-progress \| done | ... |

Build order: <id> → <id>, <id> → <id>

## Change Log
[Append-only: date, module id, what changed, what propagated.]
```

- Module ids are kebab-case, chosen once, never renamed.
- Dependencies point one way — a cycle means the two modules are really one.
- An interface between two modules is documented at the provider module, cited from the
  nexus by id + heading, never copied into the nexus.
- `ready` means: spec approved, `Blocked by` column empty. Nothing moves to `ready` on
  optimism.
- The nexus itself is gated — the human reviews module boundaries, dependency direction,
  and build order before any module spec is written.

Then recurse: run spec → (routing per `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`) for each module,
in dependency order.

## Citation convention

Specs cite each other by **module id + heading**, never by line number:
`SPEC-billing.md#pricing-rules`, not `SPEC-billing.md:42`. Line numbers rot silently on
every edit; a heading reference breaks loudly at the next sync pass instead.

## Keeping a multi-spec corpus in sync

Run after every module spec edit, not only at phase boundaries:

1. Update that module's own nexus row (status, `Blocked by`).
2. Find every citer: search the corpus for the module id.
3. Re-resolve each citation found — does the target heading still exist, still mean
   what the citer assumed.
4. If the edit changed a boundary interface, propagate to every dependent module's spec,
   or flip it to `blocked` naming this module in `Blocked by`.
5. Recompute readiness for anything whose `Blocked by` just emptied.
6. Append one Change Log line: date, module id, what changed, what propagated.

`/seed:spec-sync` automates this; running it by hand after a module edit has the same
effect and is required if the command is skipped.

## Corpus hygiene — a separate, periodic pass

Sync propagates one module's change to its citers. It does not catch drift that
accumulated across many edits, or a claim that quietly stopped matching the code. That is
a distinct pass, `/seed:verify --specs`, covered in `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md`. Run it
before treating any spec's claims about current implementation state as authoritative for
a new decision.
