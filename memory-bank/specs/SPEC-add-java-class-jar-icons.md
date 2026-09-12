# SPEC: Add .class and .jar icon mappings

status: approved

## Objective

Add `class: 'javaclass'` and `jar: 'jar'` to `desktop/src/file-icon-map.js`'s
`byExtension` table, and vendor `javaclass.svg`/`jar.svg` into `desktop/src/file-icons/`.
Both icons already exist in the upstream set (confirmed) but were left out of the
original curated list.

## Boundaries

**Always:** verify both icon filenames exist upstream before vendoring (already done —
`javaclass.svg`, `jar.svg`), and cross-check every mapping value against the actually
vendored files after writing the entries, per
`agent-rules/_learned/vendoring-external-assets.md#verify-before-mapping`.

**Never:** touch any other entry in `file-icon-map.js`.
