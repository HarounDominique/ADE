# Reflection: editor-autocomplete

## Step 1: Implementation vs. spec

Exact match, no deviations of substance. The one unspecified detail (where in
`package.json`'s dependency list to insert the new direct dependency) was resolved by
judgment (alphabetical) and accepted in review — not a spec gap, just a level of detail
the spec correctly left open.

All boundaries held: no Monaco changes were needed or made, no new language support was
added, no language server was introduced. The operator manually confirmed the core
mechanism works in `npm run desktop:dev`.

## Step 2: Workflow evaluation

Complexity routing matched the task's real shape: a single-phase plan was correct, no
phase boundary was missing, no sharding leak. Every build step (RED/GREEN, batch test,
review) passed on its first attempt — no retries, no escalation to a higher model tier.

The spec-writing investigation (reading `suggestController.js`, `codemirror/dist/index.js`,
and each `@codemirror/lang-*` package's dist file directly before writing a line of the
spec) is the same discipline `editor-find-replace-shortcuts` already validated
positively — a third confirmation of the same practice, not a new lesson. Consistent
with that task's own reflection, this doesn't bump `mirror-pattern-verification`'s
evidence count (that rule tracks failures-of-mirroring specifically, not general
verify-before-writing practice).

The real gap was upstream of the build entirely: the operator's very next message after
confirming the shipped feature works asked for something colloquially also called
"autocomplete" — abbreviation-triggered snippet expansion (`sout` + Tab → a full
boilerplate statement, a for-loop skeleton, etc.) — which this spec's Objective
explicitly scoped out ("keyword/snippet completions from each language package" meant
*already-bundled* package snippets, not authored abbreviation shortcuts). The
clarifying question asked before writing the spec (semantic/LSP-based vs. syntactic)
correctly resolved the scope axis it targeted, but didn't surface this second, orthogonal
meaning of "autocomplete" that the request's own wording ("recomiende o autocomplete
sintaxis") was already hinting at. New rule below.

## Step 3: Extracted rules

New entry in `agent-rules/_learned/spec-writing.md`: `overloaded-feature-term-disambiguation`.

Next: `/seed:archive editor-autocomplete`.
