# Creative: drag-and-drop visual design — explorer-selection-and-drag-drop

## Step 1 — does this actually need a design pass?

The spec's Boundaries already resolved the bigger question (no confirmation dialog —
immediate move + toast, matching JetBrains). What's still open: how a valid drop target
is visually distinguished from an invalid one, whether the dragged row itself gets any
treatment, and how "drop on empty tree space to move to root" reads visually. None of
these are pinned down by a Boundary line, and the spec explicitly deferred them here
("finalized in the `/seed:creative` pass"). So: yes, this phase needs it.

## Step 2 — exploration

**Constraint from the existing app**: every tree-row state today (`hover`, `.selected`
for the open file) is a flat background-color swap — no borders, outlines, shadows, or
animation on tree rows anywhere in `styles.css`. A new visual language for drop feedback
that doesn't match this (e.g. a dashed border, a drop-shadow, an animated pulse) would be
the first tree-row treatment in the app that isn't "change the background color."

**Alternatives for a valid drop target:**

| Option | Description | Cost / fit |
|---|---|---|
| A. Background tint (chosen) | `color-mix(in srgb, var(--blue) 22%, var(--panel-soft))` on the hovered directory row (or the tree container itself, for root) | One CSS rule, reuses the existing token, matches every other row-state in the file |
| B. Border outline | 2px solid `--blue` around the row | New visual primitive nothing else in the tree uses; more code for no real clarity gain over a stronger tint |
| C. Tint + inline icon/label ("Move here") | Adds an affordance icon | Extra markup, extra i18n-shaped string, disproportionate for a single-operator desktop tool |

**Alternatives for an invalid drop target** (hovering a file, or a descendant of the
dragged directory):

| Option | Description | Cost / fit |
|---|---|---|
| A. Rely on the native cursor (chosen) | Simply don't call `preventDefault()` in `dragover` for an illegal target — the browser then shows its own "not allowed" cursor automatically, with zero extra CSS | Free; matches the platform convention operators already know from every other app |
| B. Red tint on illegal targets | Explicit red highlight | Introduces a new semantic color (error/danger) onto the tree for a case the OS cursor already communicates; redundant |

**Dragged row itself:**

`opacity: .55` on the row being dragged (toggled by a `.dragging` class set in
`dragstart`, cleared in `dragend`), so the operator can see which row is mid-move against
its normal siblings. The browser's own translucent drag-ghost image (default, no custom
`setDragImage`) is left as-is — building a custom ghost image is unjustified effort for
what the OS already renders acceptably.

**Root drop (empty tree space):**

The same `.workspace-drop-target` class as a directory row, applied instead to
`#workspace-tree` itself when the `dragover` target is the tree background rather than a
row. No separate visual language for "drop to root" — it is the same affordance, aimed at
a bigger, unambiguous target.

## Decision

- `.workspace-entry.workspace-drop-target { background: color-mix(in srgb, var(--blue) 22%, var(--panel-soft)); }`
  applied to a directory row on `dragover` when the drop would be legal; removed on
  `dragleave`/`drop`/`dragend`.
- `#workspace-tree.workspace-drop-target { background: color-mix(in srgb, var(--blue) 10%, var(--panel-soft)); }`
  (softer, since it's the whole container) for the root-drop case.
- `.workspace-entry.dragging { opacity: .55; }` on the source row for the duration of the
  drag.
- No new color token, no red/error state, no custom drag image, no confirmation UI.
- Legality (which target gets `preventDefault()` + the highlight) is computed in JS per
  the spec's Boundaries: a file is never a legal target; a directory is illegal if it is
  the dragged item itself or a descendant of it (`destination.startsWith(dragged)` on the
  frontend, mirroring the backend's own check — belt-and-suspenders, since the backend is
  the actual authority, but skipping the highlight on an illegal hover avoids inviting a
  drop the backend will just reject).

## What this costs

Three small CSS rules, one JS legality check reused for both the highlight and (already
planned) drop dispatch, one `.dragging` class lifecycle. No new dependencies, no new
color semantics, nothing that needs its own follow-up design pass.
