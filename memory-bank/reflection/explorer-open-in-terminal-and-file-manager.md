# Reflection: explorer-open-in-terminal-and-file-manager

## Step 1 — Implementation vs. spec

Everything in `SPEC-explorer-open-in-terminal-and-file-manager.md` shipped and was
confirmed working by the operator on the first manual-verification pass — the second
consecutive Explorer task where that pass raised zero follow-ups (after
`explorer-delete-and-rename`). All Boundaries held: `reveal_in_file_manager` resolves
through `WorkspaceRoot::resolve()`, a new terminal tab always starts inside the jail
`terminal_start_in` already enforces, every existing `createTerminalTab()` call site
kept its exact default behavior, and the reveal action opens the containing folder only
(no per-OS "select this file" special-casing) as decided during spec review.

Two deviations, both caught in review, neither shipped as a surprise:

1. **Phase 1**: the spec's Test strategy asked for the *command's* success path to be
   covered ("file resolves to its parent, directory resolves to itself"), but exercising
   `reveal_in_file_manager_in`'s success path would spawn a real OS file-manager process
   during `cargo test` — the same problem `open_file_in`'s own tests already work around
   by testing only its rejections. Resolved by extracting the pure decision
   (`containing_folder_of`) into its own directly-testable function, satisfying the
   spec's actual intent without the side effect. This precedent existed in the codebase
   already; it had to be *noticed* (by reading `open_file_in`'s tests) rather than
   looked up anywhere. See `[[extract-pure-logic-from-process-spawning-commands]]`.
2. **Phase 2**: an unstarted terminal tab now freezes its `cwd` at creation time instead
   of reading `workspaceRootPath` lazily at first use — observable only if the operator
   creates an idle tab, switches Projects, then types into it for the first time. Judged
   an accidental side effect of the original hardcoding, not a relied-upon behavior;
   flagged rather than engineered around. Too narrow a case for its own learned rule.

## Step 2 — Workflow evaluation

- **Complexity routing**: "standard" tier fit — no open design decision (the file-manager
  behavior question was resolved during spec review, not deferred to creative). Not
  mis-routed. This was also the smallest of the four Explorer tasks (3 phases instead of
  4-5), and the roadmap said so explicitly rather than padding it to match the others'
  shape — worth normalizing: phase count should track a task's actual size, not the
  precedent of sibling tasks in the same arc.
- **Sharding**: no build step needed context its own step file lacked.
- **Spec correction mid-build**: none in the sense of the *spec* being wrong — the one
  real gap was in the Test strategy's assumption about what was safely testable, caught
  immediately by trying it, not discovered by the operator.
- **Trend across the four-task Explorer arc**: task 1 shipped a gap the operator found
  after using it; task 2 caught one gap in review, one still reached the operator; tasks
  3 and 4 both caught everything in review and the operator's manual pass found nothing
  to fix, twice in a row. The accumulated `agent-rules/_learned/` entries from tasks 1-2
  appear to be doing real work by task 3-4, not just task 3.

## Step 3 — Patterns extracted

New topic file:

- `testing-side-effecting-code.md` → `extract-pure-logic-from-process-spawning-commands`
