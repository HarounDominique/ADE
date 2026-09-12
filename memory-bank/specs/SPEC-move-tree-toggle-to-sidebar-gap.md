# SPEC: Move the tree expand/collapse button to the sidebar gap strip

status: approved

## Objective

Move the `toggle-explorer` button (the arrow that expands/collapses the workspace tree
to full height) out of the Explorer's icon row (`.explorer-actions`, alongside New/
Reveal/Refresh) and into the thin horizontal gap between the navigation tabs and the
Explorer section — the same floating strip the sidebar-collapse `<` control already
occupies (positioned via the existing `--sidebar-control-y` CSS variable, computed by
`syncSidebarControlAnchor()`), but centered horizontally in that strip rather than at
its right edge.

## Boundaries

**Always:** reuse the existing `--sidebar-control-y` mechanism (no new JS positioning
logic) so the moved button tracks the same gap `.sidebar-collapse` already tracks,
including through sidebar-width changes and the resize/expand animations
`trackSidebarControlAnchor()` already drives. Keep the button's `data-action="toggle-explorer"`
and all existing `aria-*`/title attributes and click behavior completely unchanged; only
its position and container move. Hide it whenever the sidebar itself is collapsed
(`.sidebar-collapsed`), matching how the Explorer section it controls is already hidden
in that state.

**Never:** change what clicking the button does, or duplicate it (one button, moved, not
copied) — `.explorer-actions` keeps its other three icons (New, Reveal, Refresh)
unaffected.
