# Reflection: editor-code-snippets

## Step 1: Implementation vs. spec

All 5 phases match the spec's Structure/Style/Scope sections exactly, including its
documented per-language exceptions (no class-or-equivalent for 6 languages, no `while`
for Elixir). Two real content bugs were caught by review before merge and fixed in the
same phase's commit, never shipped:

- Phase 2: `C`'s catalog entry omitted the `struct` class-or-equivalent the spec's own
  Scope text explicitly required for it (grouped with Rust and Go) — an orchestrator
  content error, not a TDD-agent error, since the exact templates were dictated in the
  build prompt.
- Phase 4: PowerShell's `for` template was missing `$` sigils on its variable
  references, making it syntactically invalid PowerShell — and the fix pass also
  caught an identical, already-*committed* gap in Phase 2's PHP `for` template
  (`${limit}` missing its sigil), fixed in the same commit rather than left for a
  separate task.

Both are examples of the same underlying risk: hand-dictated template content across
20 authored languages is exactly the kind of volume where a human/orchestrator error
is more likely than an agent's, and review is what caught both — the pipeline worked
as designed.

The spec itself needed two corrections mid-build, both surfaced by Phase 2's review,
not assumed: C and C# were mis-classified as CodeMirror-engine in the original spec
draft (they're Monaco-engine); Tier B's documented idiom list hadn't anticipated the
`main`-skeleton idiom that ended up being added to C++/C/C#/Rust. Both corrected in the
spec directly, dated, not silently rewritten.

## Step 2: Workflow evaluation

Five-phase routing matched the task's real shape: the volume (22 authored languages
across two engines) genuinely needed splitting, and each phase's boundary
(mechanism+seed, C-family, JVM/mobile, scripting, completeness) was independently
committable and reviewable — no phase felt arbitrarily sliced.

A session-wide API rate limit hit mid-build (during Phase 4's re-review), blocking both
an opus-tier and a sonnet-tier subagent dispatch. Handled by the orchestrating session
performing the re-review directly (reading every catalog entry by hand, tracing the
`toMonacoSnippet` regex against every sigil-bearing template) rather than stalling the
build — documented as a deviation in the task file, not silently treated as equivalent
to a subagent pass. The same thing recurred for Phase 5's TDD/batch-test steps; by the
time Phase 5's review was dispatched, the limit had cleared and normal dispatch
resumed. No loss of rigor, but worth naming as a real operational mode this workflow
needs to tolerate gracefully, not just in theory.

The costliest part of this task by far was **downstream of the build entirely**: the
operator's first manual-verification report ("sout+Tab does nothing") triggered an
extensive debugging investigation — headless CodeMirror reproductions proving the
wiring correct in isolation, live instrumentation via temporary `console.error` calls
read back through the operator's devtools, multiple full kill+rebuild+restart cycles —
before the mechanism was confirmed working with **no code change at all** between the
failing and passing runs. The proximate cause was almost certainly a stale cached
WebView bundle that an earlier single restart hadn't actually invalidated. This cost
far more session time than the entire 5-phase build. New rule below.

## Step 3: Extracted patterns

New entry in `agent-rules/_learned/desktop-webview-constraints.md`:
`suspect-webview-cache-before-the-mechanism`.
