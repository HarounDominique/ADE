# SPEC: Explorer tree path-matching is separator-agnostic

status: approved

## Objective

`expandExplorerFrom`, `revealSelectedFileBranch`, and `expandWorkspaceTreeTo`
(`desktop/src/main.js`) each rebuild a candidate path by string-joining
`workspaceRootPath` with forward-slash-separated segments (`` `${currentPath}/${segment}` ``),
then find the matching tree button via `candidate.dataset.directoryPath === currentPath`
— exact string equality. On Windows, `dataset.directoryPath` is Rust's native
backslash-separated path (e.g. `C:\Users\x\proj\src`), while the hand-built
`currentPath` mixes separators (`C:\Users\x\proj/src`). The strings never match, every
guard (`if (!matchingButton) break/return`) fires silently, and the Explorer tree
never auto-expands to a newly created/moved/opened file on Windows — no error, no
crash, just nothing happening. Fix: compare paths through the existing
separator-agnostic `pathSegments()` utility (`desktop/src/paths.js`) instead of raw
string equality, everywhere this pattern occurs.

## Structure

- **`desktop/src/paths.js`**: new `pathsEqual(a, b)` — segments both sides via the
  existing `pathSegments()` and compares element-by-element. Exported alongside the
  module's existing utilities, same file, same convention (already the shared home for
  "every split and every prefix test goes through these, which accept either").
- **`desktop/src/main.js`**: all three functions' `.find((candidate) =>
  candidate.dataset.directoryPath === currentPath)` becomes `.find((candidate) =>
  pathsEqual(candidate.dataset.directoryPath, currentPath))`. `currentPath` itself is
  unchanged (still hand-built with `/` as the interim accumulator) — `pathsEqual`
  re-segments it regardless of which separator was used to build it, so the fix is the
  comparison, not the construction.
- **Tests**: new `tests/paths.test.ts` (no test file exists for `paths.js` at all
  today, despite it backing path logic used throughout the Explorer) covering
  `pathSegments`, `pathBaseName`, `pathDirname`, `fileExtension`, and the new
  `pathsEqual` — including the exact mixed-separator case this bug produces
  (`pathsEqual('C:\\Users\\x\\proj/src', 'C:\\Users\\x\\proj\\src')` must be `true`).

## Style

`desktop/src/paths.js`:

```js
export function pathsEqual(a, b) {
  const left = pathSegments(a);
  const right = pathSegments(b);
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}
```

`desktop/src/main.js`, one of the three (the other two change identically):

```js
const matchingButton = [...document.querySelectorAll('[data-directory-path].directory')]
  .find((candidate) => pathsEqual(candidate.dataset.directoryPath, currentPath));
```

## Test strategy

- `node --import tsx --test tests/paths.test.ts` — new file, direct unit coverage of
  `pathsEqual` and the existing (previously untested) utilities in `paths.js`.
- `node --check desktop/src/main.js`.
- This bug is Windows-only and cannot be exercised end-to-end on this development
  machine (macOS) — the unit test on `pathsEqual` with a Windows-shaped path string is
  the actual regression guard; no live manual verification is possible for this one.

## Boundaries

**Always:** every place in `desktop/src/main.js` that compares a hand-built path
against a `dataset.directoryPath`/`dataset.filePath` for tree-matching purposes goes
through `pathsEqual`, not `===` — this task fixes the three call sites the audit
found; if more exist, they get the same treatment.

**Never:** never changes what separator `currentPath` is built with — only how it's
compared. Rewriting the accumulator itself is unnecessary scope.
