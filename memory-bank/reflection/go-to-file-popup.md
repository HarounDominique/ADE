# Reflection: go-to-file-popup

## Step 1: Implementation vs. spec

Phase 1 matched the spec exactly (one review-caught bug: `showModal()` on an
already-open dialog). Phase 2 — manual verification — surfaced a bug the spec
couldn't have anticipated (arrow-key navigation appearing completely broken), which
took two rounds to actually fix:

- **Round 1** hypothesized the wrong layer entirely: assumed the keydown listener's
  attachment point (element-local vs. document-delegated) was the problem, because
  that is a real, previously-seen bug class in this exact file (the label-click and
  keyboard-activation bugs from `changes-tab-status-glyphs-and-selective-commit`).
  Rewrote it to match the delegated pattern. The operator retested with the identical
  symptom — the fix changed nothing, because the JS was never broken.
- **Round 2** found the actual cause: `.quick-open-result.active`'s CSS. `--panel`
  and `--panel-raised` are visually indistinguishable in this app's light theme
  (`#ffffff` vs `#fdfeff`) — the `.active` class was toggling correctly on every
  keypress the entire time; the operator's screen just never showed it.

## Step 2: Workflow evaluation

The real lesson is in the *order* these two rounds happened in, not just their
individual causes. A report of "nothing visibly happens" was diagnosed by reaching
for the most recently-seen bug pattern (event delegation) rather than first ruling
out the layer closer to what was actually reported — "visible" is a rendering claim,
not an event-handling claim. Once round 1's fix demonstrably didn't change the
symptom, that result itself was strong evidence the hypothesis was wrong and should
have redirected the search toward rendering/CSS immediately, which is what round 2
then did. The redirect happened, but only after a full manual-verification round-trip
cost the operator a second test cycle that a more careful first diagnosis might have
avoided — worth remembering: when a fix doesn't change the symptom at all, that is
data, not just bad luck, and it should shift the search to a different layer rather
than to a different fix within the same layer.

Complexity routing (standard, no creative) was fine for the build itself; the
manual-verification step earned its "mandatory, not a formality" framing from this
spec twice over in one task.

## Step 3: Extracted rules

Two, in different existing topics:
- `desktop-webview-constraints.md`: a new entry, but not about delegation this time —
  about diagnosing "nothing visibly happens" reports by checking render/contrast
  before re-reaching for the most recently-seen JS bug class, especially once a first
  fix attempt provably doesn't change the symptom.
- No new rule for the CSS pattern itself — `color-mix(var(--blue)) + inset box-shadow`
  for active-row indicators is a `Structure`/`Style`-level convention worth a spec
  reusing next time, not a `_learned` rule; specs for new list/row UI should just cite
  `.git-pending-file.active` as the reference implementation the way this task's own
  fix did after the fact.

Next: `/seed:archive go-to-file-popup`.
