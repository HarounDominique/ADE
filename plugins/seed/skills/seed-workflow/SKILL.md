---
name: seed-workflow
description: Run the SEED spec-grounded development workflow in Codex. Use when a task needs explicit specification, phased implementation, verification, review, or human-gated shipping.
---

# SEED workflow

Use this skill when the user asks to build, change, review or ship software in
a repository. SEED is the workflow contract; the host agent supplies tools.
The companion skills cover initialization, routing, design, reflection,
archiving, diagnostics, roadmaps, spec synchronization and upgrades.

## Phases

Route the task through the smallest valid sequence:

`FRAME → EXPLORE → DESIGN → BUILD → VERIFY → REVIEW → RECONCILE → SHIP`

Use `quick` for a small local change, `standard` for a normal feature or bug,
`design-heavy` for a public contract or architectural change, and `recovery`
when new evidence contradicts the current plan.

Every BUILD produces a ChangeSet. Every executable change produces verification
evidence. Required review is independent. SHIP requires explicit human
approval. A failure recommends a re-entry phase; it never silently skips a
gate.

## First actions

1. Inspect `memory-bank/` and repository state.
2. If no task spec exists, write `memory-bank/specs/SPEC-<slug>.md` before
   planning. For multiple independently testable capabilities, establish a
   nexus and module specs first.
3. Record assumptions and acceptance criteria.
4. Do not invent missing repository facts; inspect them or mark them unknown.

## Build discipline

- Write and run a failing test before implementation when the change is
  executable.
- Run the affected test batch after implementation.
- Review the staged diff and run the deterministic commit guard.
- Keep the memory bank and documentation synchronized with the code.
- After two failed attempts at the same workflow step, stop and ask for a
  human decision rather than escalating indefinitely.

## Codex host boundary

Use Codex tools and repository instructions for execution. Do not use Claude
Code flags, `/seed:*` slash commands, Claude's plugin-root placeholder, Claude hooks or
Claude-specific permission modes. The workflow rules above are shared; the
host invocation mechanism is not.

## Completion report

Report the changed files, tests/builds run, unresolved evidence, and whether
human approval is still required. Never claim a gate passed without evidence.
