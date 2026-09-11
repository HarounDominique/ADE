# Step 1 — git setup

Create or confirm the worktree and branch for this task before any code changes.

1. Branch name: `feature/<slug>` (or `task/<slug>` for fast-path tasks per
   `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`).
2. If the branch already exists (resuming), check it out; do not create a duplicate.
3. Confirm the working tree is clean before proceeding — uncommitted changes from a
   previous interrupted run are a resume signal, not something to discard.
4. Write execution state: `Build Status: RUNNING`, `Current Phase: <N>` (the phase
   number this invocation is starting — the first unchecked box in the Implementation
   Roadmap; this is the only field that says which phase is live, so get it from the
   roadmap, not by incrementing a stale prior value), `Current Step: 2/6`,
   `Step Attempts: {2: 0, 3: 0, 4: 0}` (fresh phase — reset regardless of what a prior
   phase left behind; see `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md` rule 3).

Return: proceed to step 2.
