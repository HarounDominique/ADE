# Reflection: changes-tab-status-glyphs-and-selective-commit

## Step 1: Implementation vs. spec

Backend (Phase 1) matched the spec exactly, no deviations — the `git reset` determinism
claim was verified against real `git` before the spec was even written, so nothing
surprised the build. Frontend (Phase 2) matched the spec's snippets closely, but the
spec's own Style section proposed the `<button>` → `<div role="button">` conversion
(necessary — a checkbox cannot legally nest inside a `<button>`) without naming what
that conversion costs: keyboard activation is not automatic on a non-native
interactive element, and neither the spec nor the first implementation pass wired it
back. A second issue — a checkbox's own `<label>` forwarding a click to its nested
`<input>` can produce two observable click events for one user action — was also
absent from the spec, since it only manifests once an interactive control (the
checkbox) is nested inside another click target (the row). Both were caught in review
(step 4), not by the operator, and both are now covered by regression tests.

One scope note, not a bug: `gitFileLabelMarkup` is shared between the Changes tab
(this task's target) and the History tab's per-commit file list. Reusing it rather
than forking a near-duplicate function means the History tab picked up the same
colored glyphs as a side effect the spec's Objective never named. Flagged explicitly
to the operator rather than left silent.

## Step 2: Workflow evaluation

Complexity routing (standard, no creative) was right for the backend half and mostly
right for the frontend half — the design decisions (checkbox default state, selection
reset semantics, staging determinism) were all resolved during the assumptions step
before the spec was written, which is exactly what that step is for. What the spec
*couldn't* anticipate was a second-order consequence of its own Style choice: turning
an interactive element into a non-native one has a fixed, well-known cost (keyboard
access, label-click semantics) that isn't visible from the diff alone — only from
actually reasoning about how a browser dispatches events to the new shape. This is a
different failure class from every "zero-commit repository" bug this session's other
tasks kept finding: those were gaps in domain knowledge about git; these are gaps in
DOM/event-model knowledge specific to changing an element's interactivity model.

## Step 3: Extracted rules

One new entry in `desktop-webview-constraints.md`: converting a native interactive
element (`<button>`) to a `role="button"` div to legally nest a second control costs
keyboard activation and label-click correctness, and both must be re-added explicitly
— not "some day if it comes up," but as a named cost that a spec proposing such a
conversion should call out, and a build phase should specifically check for even when
the spec doesn't.

Next: `/seed:archive changes-tab-status-glyphs-and-selective-commit`.
