---
topic: environment-safety
priority: high
---

### gui-automation-unsafe-in-this-environment
_derived_from: reflection/explorer-new-file-folder.md · evidence_count: 1 · last_validated: 2026-09-12_

Never attempt coordinate-based OS-level GUI automation (macOS `osascript`/System Events
`click at {x,y}`, `cliclick`, or similar) against a desktop app to "verify" a feature in
this environment — there is no isolated display or sandboxed GUI target here, only the
operator's real physical desktop, and a click has no reliable guarantee of landing on the
intended window (confirmed: one such attempt mis-clicked into the operator's own,
unrelated Safari window). Ask the operator to manually verify GUI behavior instead.
