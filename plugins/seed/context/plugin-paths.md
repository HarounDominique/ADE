# `${CLAUDE_PLUGIN_ROOT}` — a placeholder, not a shell variable

Every cross-reference in this plugin (`${CLAUDE_PLUGIN_ROOT}/context/...`,
`.../agents/...`, `.../templates/...`, `.../scripts/...`) uses this placeholder to mean
"this plugin's own installed location" regardless of where a consuming project's `cwd`
is. For the **Read** tool this resolves transparently — you already know the plugin's
real absolute path (it's where the command/agent file you're following was itself loaded
from), so reading `${CLAUDE_PLUGIN_ROOT}/context/foo.md` just means reading that real
path with `context/foo.md` appended.

**It is not an exported environment variable.** When a step needs to *run* a script from
`scripts/` via the Bash tool — not read a doc via Read — the literal string
`${CLAUDE_PLUGIN_ROOT}` means nothing to the shell, and a command like
`node ${CLAUDE_PLUGIN_ROOT}/scripts/foo.mjs` fails with "Cannot find module": the
shell sees a literal, empty-expanding `${CLAUDE_PLUGIN_ROOT}` token, not the real path.

**The fix is always the same:** substitute the real absolute path yourself before writing
the Bash command, the same way you already do implicitly for Read. Never pass the literal
placeholder string into a shell command and expect the shell to resolve it.
