# Reflection: editor-find-replace-shortcuts

## Step 1: Implementation vs. spec

Exact match, no deviations in either phase. The spec itself was written only after
reading both editor engines' actual source (`node_modules/codemirror/dist/index.js`,
`node_modules/@codemirror/search/dist/index.js`,
`node_modules/monaco-editor/.../findController.js`) rather than assuming what "Monaco
probably has built in" meant — which is exactly what turned an apparent 4-shortcut
feature request into a 1-line-per-engine fix, since 3 of the 4 requested bindings
already existed, verbatim, on both engines.

## Step 2: Workflow evaluation

This is the positive case of the same discipline `offer-git-init-when-no-vcs`'s
reflection named from its failure side (`mirror-pattern-verification`): verify a claim
against the real source before writing it into a spec, not after a build phase
discovers it's wrong. Applied here at spec-writing time instead of discovered as a
deviation, it produced zero surprises in Phase 1 or Phase 2 — worth noting as positive
evidence for that same rule, not a new one.

The one genuine unknown (`Mod-r`/`Ctrl-r` risking a native WebView reload) was
correctly identified as something no amount of source-reading could resolve, and was
left to manual verification rather than guessed at or silently worked around — the
operator confirmed it does not reload.

## Step 3: Extracted rules

None new. This reconfirms `mirror-pattern-verification`
(`agent-rules/_learned/spec-writing.md`) rather than adding a fresh entry — bumping
its evidence would double-count the same lesson from the opposite direction (a spec
that verified correctly, not one that didn't), which isn't what that rule's
evidence_count tracks.

Next: `/seed:archive editor-find-replace-shortcuts`.
