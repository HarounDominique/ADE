# Spec corpus hygiene — periodic self-audit

A spec corpus rots without ever failing a build: a citation can point at a heading that
moved, a derived count in prose can drift from the table it summarizes, a decision can
call something "not built" long after it shipped. None of this looks wrong. This pass
exists to catch it before it is trusted for a new decision.

Complements `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`'s sync protocol, which propagates one module's change
to its citers. This pass re-verifies the whole corpus against itself and against the code,
for drift that accumulated across many edits.

## Phase 0 — mechanical checks, before any judgment

Anything a script can catch, a script catches first:

- **Citation resolution** — every `SPEC-<id>.md#<heading>` reference still resolves.
- **Derived counts** — any total or tally in prose still matches the table it summarizes.
- **Structural conventions** — heading numbering, table shape, status-marker convention,
  consistent everywhere, not just where last touched.

Fix everything these report before Phase 1. Never silence a red result by excluding it —
either the citation is wrong (fix it) or the check is (fix the check). Re-run until green.

## Phase 1 — parallel read-only semantic audits

None of these edit anything.

- **Self-audit of the last hygiene pass** — take the most recent corpus-edit commit (or
  current diff) and try to refute every factual claim in it against the current tree.
  Highest-yield lane: it audits the auditor.
- **Referential integrity** — an id referenced but never defined, a heading reference
  whose target has no such subheading, two independently-numbered series that collide.
- **Cross-document coherence** — two specs asserting incompatible things about the same
  fact; a spec describing something as future/absent that the code and tests already
  show built; a decision claiming something deferred whose implementation predates the
  decision's own date.

Every finding carries its evidence inline — location of the claim, location of the
contradiction, literal quotes. A finding without evidence is discarded at triage.

## Phase 2 — triage: fix or register, never guess

> Fix what has a verifiable answer in the corpus or the code.
> Register as an open gap anything that needs a decision that isn't yours to make.

The test: can the correction be written and pointed at the file that proves it right? If
yes, fix it now. If the answer starts with "the sensible thing would be", it is a gap —
register it in the nexus's Open Questions (or the task file, if no nexus exists), at its
real severity, cited from the exact clause it affects.

Never resolve a registered gap unilaterally. Never edit a rule to match a deviation
instead of correcting the deviation. Never downgrade a finding to shrink a count.

## Phase 3 — apply fixes with discipline

1. Never bulk-edit a structured row (table row, id) with a pattern-matching tool — edit
   one at a time by its full text, then re-run Phase 0.
2. A fact stated in N places is corrected in all N or in none — grep first, list every
   site, fix them all, re-grep to confirm zero old values remain outside historical notes.
3. A correction note describes the state after the fix, written after the fix, never
   before it is applied.
4. Every figure is verified by counting at the moment of writing it, never inherited from
   memory or a previous note.
5. Editing a heavily-cited document means re-running the citation check after that batch,
   not once at the very end.

## Phase 4 — close the pass

- Automated checks green again, citation check included even if untouched this pass.
- Audit your own diff the same way Phase 1's self-audit lane audits a past one.
- Fix what that finds, in this same pass — do not defer it to "next time".
- State the stopping metric explicitly: per defect class, how many closed, how many
  introduced this pass.

## When NOT to run this

A single spec being written for the first time — nothing to audit yet. A one-line fix to
a single known-wrong fact — just fix it.
