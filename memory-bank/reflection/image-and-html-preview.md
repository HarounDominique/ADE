# Reflection: image-and-html-preview

## Step 1 — Implementation vs spec

Spec: `memory-bank/specs/SPEC-image-and-html-preview.md`. Decision origin: `docu/adr/
0060-image-and-html-preview.md`, already accepted before this task's spec was written —
no design decision was open during build, which matches the roadmap's "no creative
needed" call on every phase.

All 5 phases shipped and match the spec's Structure section:

- **Phase 1** (raster image): whitelist (`png`/`jpg`/`jpeg`/`gif`/`webp`/`bmp`/`ico`),
  same `MAX_FILE_PREVIEW_BYTES` cap, `@panzoom/panzoom` pan/zoom, `Open externally`
  unchanged. Matches Boundaries exactly — no broader binary passthrough introduced.
- **Phase 2** (SVG): `Preview`/`Source` toggle, `Blob`+`createObjectURL` into `<img>`,
  no backend change (SVG was already `kind: "text"`). Matches spec.
- **Phase 3** (HTML, security-critical): `<iframe sandbox srcdoc>` with the empty/bare
  sandbox value — the maximally restrictive form, `allow-scripts` never present. This is
  the one phase reviewed at the highest bar (two independent trace-throughs of every
  `sandbox`/`srcdoc` call site), and it held up clean on the first pass — no rework.
- **Phase 4** (Mermaid): `securityLevel: 'strict'` set explicitly (verified as also
  Mermaid 12's shipped default, not assumed), fence-detection rule alongside the
  existing `markdownHeadingAnchors`/`markdownTaskLists` core rules, standalone `.mmd`
  support. This phase needed two extra review rounds — see Step 2.
- **Phase 5** (verification): full regression, licence-row check, operator manual pass
  in `npm run desktop:dev` across all four formats — confirmed by the operator via chat
  instruction to proceed to `reflect`+`archive`, not a itemized per-format report; taken
  as sufficient operator sign-off per the task's own Boundaries (no stronger evidence
  format was specified as required).

**Deviations, all recorded live in `memory-bank/tasks/image-and-html-preview.md`'s own
Deviations section** (not duplicated here in full): the literal `kind: "image"` string
choice, the hand-rolled base64 encoder instead of a new Rust crate, the parallel-clone
toggle pattern for SVG/HTML/Mermaid (accepted debt, see Step 3), the async-render race
fix and its cross-format scope (guarding Markdown's own write too, not just Mermaid's),
the `lodash-es` override for the npm-audit finding, and the branch-provenance incident
(Step 2 below).

No spec ambiguity required a correction during build — the spec held. The one drift
that did surface (ADR-0060's prose reasoning against DOMPurify reads as loosely worded
now that `mermaid` transitively pulls DOMPurify anyway) is a documentation-staleness
note, not a contract gap; flagged in the task file, not spec-synced, since it doesn't
change any interface a citer depends on.

## Step 2 — Workflow evaluation

**Complexity routing:** correct. The spec's four sub-capabilities (raster/SVG/HTML/
Mermaid) were bundled into one module spec rather than a nexus — defensible in
hindsight: they share one Editor surface and one already-resolved design decision
(ADR-0060), and the actual build phases stayed independently committable exactly as
`complexity-routing.md`'s "standard" tier expects. No mis-route in either direction.

**Sharding:** no leak found — every build-step file (`step-1` through `step-6`) had
what it needed each time this task ran, across 5 phases plus 3 extra review rounds on
Phase 4.

**Real gaps found by review, not by the TDD pass that introduced them (the main
workflow-quality signal from this task):**

1. Phase 4's stale-async-render race — a real, reachable concurrency bug, only caught
   because the second review pass was explicitly asked to verify race-condition claims
   itself rather than trust a first pass's static reasoning. → rule added (`stale-
   cached-state.md`).
2. Phase 4's missing `npm audit` on a new dependency — the exact rule this violates
   already existed in `_learned/security-defaults.md` from the `http-client` task, and
   was not self-applied. → rule reinforced (evidence_count 1→2), with an explicit note
   that the existing rule is not self-enforcing and needs to be named in the dispatch
   prompt, not assumed recalled.
3. The parallel-clone toggle pattern (Markdown→SVG→HTML→Mermaid, four near-identical
   ~25-line state machines) was flagged as debt at Phase 2's review — correctly, as a
   non-blocking observation — but the roadmap had already fixed four phases with this
   shape before that flag could change anything cheaply. → rule added (`build-dispatch-
   practices.md`) about naming the extraction as its own phase when 3+ clones are
   already planned, not waiting for review to notice after the fact.
4. **Branch provenance**: mid-Phase-5, `git diff master...feature` revealed 10 commits
   from a concurrent, unrelated session ("vendor dual-host seed plugin") that had
   landed directly on this task's branch in the shared working directory, before this
   task's own first commit. Not a build-step failure in the usual sense — no spec/test/
   review gap — but a real gap in `step-1-git-setup.md`'s implicit assumption that a
   freshly-created branch stays exclusively this task's own until the next check. Fixed
   by preserving the foreign work on its own branch and rebasing it out, both confirmed
   with the operator before any push. → rule added (`build-dispatch-practices.md`).

None of these four were caught by the step that introduced them — all four surfaced
one step later than ideal (review instead of TDD, or Phase 5 instead of Phase 1's own
setup). That is the single clearest pattern across this task: **the review gate is
doing real work, but every one of these should have been prevented earlier, cheaper,
by the step that created the condition.** All four now have rules aimed at the earlier
step, not just at review.

## Step 3 — Extracted rules

Written to `memory-bank/agent-rules/_learned/`:

- `security-defaults.md` — `audit-new-npm-dependencies-before-committing-to-them`,
  evidence_count 1→2 (second real occurrence, same exact rule, still skipped at
  implementation time — reinforces without escalating priority, since the pattern is
  "not self-applied," not "wrong when applied").
- `stale-cached-state.md` — new entry `async-render-needs-a-generation-guard` (third
  member of this topic's family: mutation-must-refresh-what-it-invalidates, read-paths-
  must-tolerate-external-drift, and now async-render-needs-a-generation-guard).
- `build-dispatch-practices.md` — two new entries: `verify-branch-provenance-before-
  the-first-phase-commit` (the shared-working-directory contamination incident) and
  `extract-shared-abstraction-on-the-third-clone` (the toggle-duplication debt).

`_learned/` stays at 9 topic files (cap 10) — all four learnings consolidated into
existing topics, no new file created.

## Step 4 — Next

`Next likely: /seed:archive image-and-html-preview`
