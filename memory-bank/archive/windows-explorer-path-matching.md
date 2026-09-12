# Archive: windows-explorer-path-matching

## Summary

`expandExplorerFrom`, `revealSelectedFileBranch`, and `expandWorkspaceTreeTo`
(`desktop/src/main.js`) now compare pending-directory paths via the new
`pathsEqual()` (`desktop/src/paths.js`) instead of raw string equality, so the
Explorer tree correctly auto-expands to a newly created/moved/opened file on Windows
regardless of mixed forward/backslash separators. Found by a Windows-parity audit
requested by the operator, not by a bug report — this bug had no visible symptom on
macOS, where it never manifests.

Satisfies: `memory-bank/specs/SPEC-windows-explorer-path-matching.md`.

## Deviations accepted

One minor process note (missed an existing `@ts-expect-error` convention on first
pass, fixed once found); no design deviations. Full detail in the task file.

## Reflection

Fast-path task; inline reflection in the task file rather than a separate document.
Cannot be manually verified on this macOS development machine — the Windows-shaped
unit test in `tests/paths.test.ts` is the actual regression guard.
