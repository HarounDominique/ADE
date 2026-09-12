# Reflection: explorer-selection-and-drag-drop

## Step 1 — Implementation vs. spec

Both capabilities in `SPEC-explorer-selection-and-drag-drop.md` shipped and were
confirmed working end to end by the operator, including edge cases (illegal drop into
self/descendant, name-collision rejection). Boundaries respected: both `move_workspace_entry`
paths resolved via `WorkspaceRoot::resolve()` independently; no silent overwrite; no
cross-Project move (inherited for free from `resolve()`'s jail); no multi-select,
reordering, or confirmation dialog added.

Three deviations, all surfaced and fixed within the task rather than shipped as gaps:

1. **The approved creative doc's chosen mechanism was wrong.** It specified native HTML5
   `draggable`/`dragover`/`drop` events. Phase 4's own contract-test batch immediately
   caught that this codebase had already tried exactly that for detaching a document tab
   into its own window and abandoned it (`documentTabStrip`'s comment: "the HTML drag
   reported nothing usable about a drop that left the window" in this Tauri WebView), with
   a standing test (`doesNotMatch(main, /draggable="true"/)`) guarding against
   reintroducing it. Rebuilt using the same mousedown/mousemove/mouseup + ghost mechanism
   already proven for tab detaching. The *visual* design approved in creative (tint on
   legal target, dimmed dragged row, no confirmation) was unchanged — only the event
   mechanism moved. This was caught by the test suite, not by manual inspection —
   validates that "run the full batch, not just the new test" (step 3) earns its keep.
2. **Review-caught gap**: if the currently selected directory was itself the one dragged
   and moved, `selectedDirectoryPath` kept pointing at a path that no longer existed.
   Fixed before commit.
3. **Operator-caught gap (Phase 5 manual verification)**: a full `loadWorkspaceTree()`
   call (run after every create/move, to reflect the change) resets every directory back
   to collapsed — so a newly created or moved entry landed invisibly nested under a
   folder the operator had to manually re-open, with no feedback the operation succeeded.
   Neither the spec nor the plan named this explicitly; it surfaced only once a human
   actually used the feature. Fixed in-phase with `expandWorkspaceTreeTo`.

## Step 2 — Workflow evaluation

- **Complexity routing**: "designed" tier (spec → plan → creative → build ×N → reflect →
  archive) fit — drag-and-drop genuinely had an open visual-design decision, correctly
  routed through `/seed:creative` before Phase 4. Not mis-routed.
- **Sharding**: no build step needed context its own step file lacked.
- **Spec correction mid-build**: the *spec* itself needed no correction (it deliberately
  deferred the visual mechanism to creative). The *creative document* needed one real
  correction (item 1 above) — worth distinguishing: this is a case where the spec-first
  discipline worked exactly as intended (spec stayed technology-agnostic; a downstream
  document absorbed the wrong call and was the one that got fixed), not a spec-hygiene
  failure.
- **Pattern across two of the three deviations** (items 2 and 3): both are "the operation
  succeeded, but nothing visible confirmed it, so the state that referenced the old
  location went stale or the result was invisible." Neither the spec's Boundaries nor the
  plan's phases asked, for either capability, "what visible feedback proves this mutating
  operation worked and what state needs to follow the mutated path." This is the same
  shape of gap appearing twice in one task — worth a rule for spec-writing, not just a
  one-off fix. See `[[mutating-operation-feedback]]`.

## Step 3 — Patterns extracted

Written to `memory-bank/agent-rules/_learned/`:

- `desktop-webview-constraints.md` → `no-native-html5-drag-and-drop`
- `spec-writing.md` → `mutating-operation-feedback` (new entry, same topic file as
  `spec-assumption-verification` from the prior task)
