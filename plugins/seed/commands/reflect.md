---
description: Close the learning loop after a task's builds finish — extracts reusable rules into agent-rules/_learned/
argument-hint: <slug>
---

# /seed:reflect — close the learning loop

Not optional and not decorative. Every closed task attempts to leave a reusable rule
behind for the next one.

---

## Memory Bank Integration

**Reads from:** `memory-bank/tasks/<slug>.md`, its spec(s), its creative doc if any,
the build phases' deviation notes, and — if present —
`memory-bank/.local/session-logs/*.md` (written by the `SessionEnd` hook) as optional
corroborating evidence of what actually happened in-session; never the sole source for a
claim, since a task can legitimately span sessions with no log for some of them.
**Updates:** `memory-bank/reflection/<slug>.md`, `memory-bank/agent-rules/_learned/`.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`.

---

## Step 1: Evaluate the implementation

Compare what was built against what the spec's acceptance criteria and boundaries
actually required — not against what felt reasonable. Note every deviation and whether
it was accepted, and by whom.

## Step 2: Evaluate the workflow itself

- Did the complexity routing (`${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`) match the task's real
  shape, or was it mis-routed in either direction?
- Did any build phase need context the sharded step file didn't have — a sharding leak?
- Did the spec need correction mid-build (a real gap) more than once?

## Step 3: Extract patterns

For each concrete, actionable learning, write a terse rule (one directive line) into
`memory-bank/agent-rules/_learned/<topic>.md`. **One frontmatter block per file, always**
— a topic file holds a list of rule entries as `###` sections below a single shared
frontmatter, never multiple stacked `---` blocks (that is not valid multi-document
frontmatter and the first parser to read only the top block silently loses every rule
after the first):

```markdown
---
topic: <topic-name>
priority: low
---

### <short-rule-name>
_derived_from: reflection/<slug>.md · evidence_count: 1 · last_validated: <date>_

<One-line directive.>

### <another-rule-name-in-same-topic>
_derived_from: reflection/<other-slug>.md · evidence_count: 1 · last_validated: <date>_

<One-line directive.>
```

New rule entries always start at `evidence_count: 1`, and the file's own `priority`
starts at `low` — never override a human-authored rule until reinforced across multiple
tasks. When a topic file already exists, append a new `###` section to it (or bump an
existing entry's `evidence_count` and `last_validated` if this reflection reconfirms it)
rather than creating a second frontmatter block. Consolidate into an existing topic file
before creating a new one; hard cap of 10 files under `_learned/`.

## Step 4: Save

Write `memory-bank/reflection/<slug>.md` with the full analysis. Report
`Next likely: /seed:archive <slug>`.
