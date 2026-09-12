# SPEC: Fix the collapsed-sidebar chevron overlapping the last nav icon

status: approved

## Objective

When the sidebar is collapsed to its narrow icon rail, the `.sidebar-collapse` chevron
(vertically centered on `--sidebar-control-y`, the gap between the nav and the Explorer)
overlaps the nav's last icon. Root cause: `syncSidebarControlAnchor()`'s gap-center
falls back to the nav's own bottom edge once the Explorer is `display:none` and the
nav's bottom margin/border are zeroed in collapsed mode — there is no real gap left to
center in, so the button (translated -50%/-50% around that point) draws half its height
upward into the last nav item. Fix: in collapsed mode only, offset the chevron's `top`
further down than the raw anchor point by roughly half its own height plus a small gap,
so it clears the nav visually instead of overlapping it. The normal (expanded) sidebar,
where a real gap exists and the anchor computation is correct, is untouched.

## Boundaries

**Always:** apply the offset only under `.sidebar-collapsed .sidebar-collapse` — the
expanded state's positioning (`.sidebar-collapse` alone, no `.sidebar-collapsed`
qualifier) must not change at all.

**Never:** touch `syncSidebarControlAnchor()`'s JS calculation itself — the fix is a
CSS-only offset on top of its existing output, not a rewrite of the anchor logic.
