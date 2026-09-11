---
description: Write the spec (or nexus + module specs) a task originates from — the mandatory first phase
argument-hint: <what you want to build>
---

# /seed:spec — write the spec that everything else traces to

The mandatory origin of every task. Nothing calls `/seed:plan` on a task with no spec.

---

## Memory Bank Integration

**Reads from:** the initiative description (argument or conversation), existing
`memory-bank/specs/SPEC-NEXUS.md` if one already exists.
**Updates:** `memory-bank/specs/SPEC-<slug>.md`, or `SPEC-NEXUS.md` + one
`SPEC-<module-id>.md` per module.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`, `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`, `${CLAUDE_PLUGIN_ROOT}/agents/spec-writer-agent.md`.
**Dispatches:** `${CLAUDE_PLUGIN_ROOT}/agents/spec-writer-agent.md` — a thin caller over the `spector` plugin's
`spec-driven-development` skill when installed; falls back to the inline method in
`${CLAUDE_PLUGIN_ROOT}/context/spec-first.md` otherwise. This command does not itself contain spec-writing
method — it gates and persists what the agent drafts.

---

## Step 0: Scope check

Read `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md` § Bundled capabilities. Does this request name more than one
independently-testable capability, or more than one distinct screen/view/menu?

- No → Step 1, single-capability path.
- Yes → Step 0a, nexus path.

### Step 0a: Nexus path

Propose `SPEC-NEXUS.md` per the template in `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`. Stop for human
review of module boundaries, dependency direction, and build order before writing a
single module spec. On approval, recurse Step 1 per module, in dependency order.

## Step 1: Surface assumptions

Before writing spec content, list every assumption being made as a numbered list. Stop
and let the human correct it before proceeding — do not silently resolve an ambiguous
requirement.

## Step 2: Write the six sections

Objective, Commands, Structure, Style, Test strategy, Boundaries — per
`${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`. One real code snippet for Style beats a paragraph describing
conventions.

## Step 3: Save and gate

Save to `memory-bank/specs/SPEC-<slug>.md` (or `SPEC-<module-id>.md` under a nexus).
Present it for explicit human approval. Status field: `draft` until approved this run,
`approved` the moment it is — `/seed:plan`'s gate (its Step 0) accepts either `ready` or
`approved` as the green light, so writing `approved` here is what actually lets a
single-spec (non-nexus) project proceed; `ready` is the nexus-module vocabulary
(`context/spec-first.md`), not required outside a nexus.

## Step 4: If a nexus exists, sync

If this spec is a module under an existing nexus, run the sync steps in
`${CLAUDE_PLUGIN_ROOT}/context/spec-first.md` § Keeping a multi-spec corpus in sync before finishing.

## Step 5: Commit

Commit the spec file(s) written this run (and the nexus, if touched) on the current
branch **now** — do not leave them uncommitted for a later command to pick up. A spec is
supposed to be cold truth the moment it exists; an uncommitted spec is a fact that git
doesn't know yet, and a crash between approval and `/seed:build`'s first commit would
lose it. Commit message: `spec: <slug>` (or `spec: <slug> — draft, unapproved` if Step 3
didn't get a human approval this run).

## Error Handling

- Request is a single-line fix / typo / unambiguous one-liner → still write a spec, but
  the fast-path form: Objective + Boundaries only, one paragraph each. Spec is shrunk,
  never skipped (see `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`).
