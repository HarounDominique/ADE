---
topic: native-file-drop
priority: low
---

### validate-native-drops-before-routing
_derived_from: reflection/terminal-attachments.md · evidence_count: 1 · last_validated: 2026-09-14_

Route desktop file drops through the native Tauri event bridge, validate regular files in Rust without reading bytes, and only then pass canonical paths to the terminal or provider-neutral composer.
