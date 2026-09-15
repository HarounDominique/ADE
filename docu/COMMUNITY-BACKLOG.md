# Community backlog

This is the first contributor backlog for ADE (the project and technical
identifier) and Assay (the product name). It deliberately contains five
well-founded tasks rather than a long list of loosely defined ideas. Each item
can be implemented incrementally or adopted by a long-term module steward.

Contributors are welcome to clone, fork or continue ADE independently. When an
improvement benefits the wider community, the maintainers would be delighted
to receive it back through an issue, discussion or pull request.

## Working agreement

Before coding, comment on the matching GitHub issue and say whether you want to
implement the task or steward the area. Read the linked specs and ADRs first.
Keep changes focused, add tests with implementation changes, record platform
evidence and update public contracts when they move.

From the repository root:

```bash
npm install
npm run build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

Do not commit generated output, local databases, credentials or private
repositories.

## Priority map

| ID | Priority | Area | Difficulty | Suggested labels |
| --- | --- | --- | --- | --- |
| CB-01 | P0 | Windows evidence and toolchain inspection | Medium | `windows`, `help wanted` |
| CB-02 | P1 | SQLite database stewardship | Medium/High | `database`, `module stewardship` |
| CB-03 | P1 | Per-turn change delta | High | `agents`, `governance` |
| CB-04 | P1 | Checkpoint integrity and retention | High | `git`, `governance` |
| CB-05 | P2 | Findings and acceptance criteria | Medium | `review`, `governance` |

## CB-01 — Make Windows support demonstrated and stable

**Problem.** Windows builds and release packaging pass, but the general CI
matrix has shown an intermittent failure in
`tests/toolchain-inspection.test.ts` while probing `npm`. A green release job
does not by itself prove stable support for the complete matrix.

**Goal.** Produce repeatable Windows evidence and make toolchain inspection
robust when version managers, PATH resolution or process startup are slow.

**Start here.** Inspect `src/application/local-runtime/toolchain-inspection.ts`,
`tests/toolchain-inspection.test.ts`, `src/application/local-runtime/` and
`.github/workflows/ci.yml`. Compare Windows and Unix process/probe paths. Do
not merely increase every timeout: first measure the slow operation.

**Acceptance criteria.**

- `windows-latest` passes the complete CI matrix repeatedly.
- Node/npm, Java and other declared probes report availability, version and
  errors consistently when present or absent.
- Timeout/retry behavior is bounded and diagnostically useful.
- The cross-platform support spec cites the new run and states remaining gaps.

**Verification.** Repeat the focused test on Windows, then run `npm test`,
`npm run build`, Rust tests and the complete CI workflow. Include runner image,
Node version and sanitized logs in the PR.

**Out of scope.** Installing toolchains for users or supporting every Windows
shell.

## CB-02 — Become steward of the SQLite database module

**Problem.** SQLite is central to Projects, Tasks, conversations, evidence,
checkpoints, settings and release metadata. It works today, but it is the
highest-leverage module for a contributor who wants to improve one subsystem
over time.

**Goal.** Establish a coherent persistence improvement plan without changing
domain contracts accidentally.

**Start here.** Read `src/persistence/sqlite-store.ts`,
`src/domain/database-schema.ts`, persistence tests, migrations and
`docu/specs/SPEC-knowledge-docs.md`. Search ADRs for persistence and settings
decisions before proposing schema changes.

**Good first improvements.**

- Document schema and migration invariants.
- Add tests for old databases and interrupted upgrades.
- Audit transaction boundaries and error recovery.
- Define backup/restore and checkpoint-retention helpers.
- Measure large-project behavior and bounded history queries.

**Acceptance criteria.**

- Existing databases remain readable or have an explicit migration.
- One domain operation is atomic at its write boundary.
- Migrations are idempotent and tested from a real prior schema.
- Sensitive values and credentials are never persisted.
- Read models remain independent of SQLite details.
- Relevant specs and ADRs explain the change and trade-offs.

**Verification.** Run `npm test`, focused persistence/migration tests, a
temporary database round-trip and a manual restart/rehydration check.

**Out of scope.** Replacing SQLite, adding cloud sync or redesigning the
domain model without a separate proposal.

## CB-03 — Record the per-turn change delta

**Problem.** A writing agent turn creates a ChangeSet, but the current
representation can describe the complete working tree instead of exactly the
files changed by that turn.

**Goal.** Use the pre-turn checkpoint and post-turn state to produce a precise,
auditable delta while preserving unrelated operator changes.

**Start here.** Read `src/application/agents/turn-checkpoint.ts`,
`src/application/agents/capture-turn-change-set.ts`,
`src/application/agents/task-checkpoints.ts`, Git adapters and
`tests/turn-checkpoint.test.ts` / `tests/agent-turn-capture.test.ts`.

**Acceptance criteria.**

- Added, modified, deleted and renamed files are classified correctly.
- Pre-existing operator changes are not attributed to the agent turn.
- The delta survives restart and is linked to its Task and turn.
- Empty turns are explicit rather than missing evidence.
- Paths remain inside the canonical Project root.
- ChangeSet and review surfaces explain the source checkpoint.

**Verification.** Use temporary Git repositories covering clean and dirty trees,
deletions, untracked files, renames, failed turns and restart rehydration. Run
TypeScript and Rust suites and include the fixture matrix in the PR.

**Out of scope.** Automatically committing the delta or changing the
operator's index/branch.

## CB-04 — Make checkpoints byte-faithful and safely retain them

**Problem.** Writing turns create refs under `refs/ade/checkpoints/`, but those
refs are not currently pruned. Git attributes and line-ending normalization can
also make a restore reproduce equivalent text rather than identical bytes.

**Goal.** Define safe retention and guarantee that restoration returns the
captured content without touching unrelated operator state.

**Start here.** Read `src/application/agents/turn-checkpoint.ts`,
`src/application/agents/task-checkpoints.ts`, the checkpoint ADR, the Git
repository port and existing checkpoint tests. Add fixtures with `text`, `eol`,
custom filters, binary files, executable files, deleted files and untracked
files.

**Acceptance criteria.**

- A repository declaring text normalization restores identical bytes.
- Binary content and relevant mode metadata survive capture/restore.
- Filters are not executed unexpectedly during checkpoint operations.
- Restore leaves `HEAD`, the index, user branches and unrelated files intact.
- A documented age/count policy prevents unbounded checkpoint growth.
- Checkpoints referenced by active Tasks or audit trails are protected.
- Cleanup is explicit, idempotent and recoverable after failure.
- Unsupported cases fail with actionable diagnostics.

**Verification.** Compare SHA-256 hashes before capture and after restore, on
Unix and Windows where possible. Test many checkpoints, protected references,
missing objects and interrupted cleanup in temporary repositories.

**Out of scope.** Generic Git garbage collection or deleting user commits.

## CB-05 — Link review findings to acceptance criteria

**Problem.** Review findings identify problems, but do not yet state which Task
acceptance criterion each finding violates.

**Goal.** Make review actionable: contributors should know what to fix and
maintainers should know what remains unverified.

**Start here.** Read `src/domain/task.ts`,
`src/application/review-change-set.ts`, review contracts/adapters,
`src/application/change-review-read-model.ts` and the governance specs.

**Acceptance criteria.**

- Review prompts include stable acceptance-criterion identifiers and text.
- Findings can cite criteria without trusting arbitrary free-form model text.
- Malformed or unknown references are rejected or shown as unresolved.
- UI and CLI display the mapping and preserve it through re-review.
- Existing reviews and databases remain readable.
- Tests cover valid, missing, duplicate and unknown references.

**Verification.** Add contract tests for OpenCode, Codex and Claude outputs,
read-model tests, re-review tests and a manual Changes/Task-detail check.

**Out of scope.** Allowing a reviewer to change acceptance criteria silently.

## Second wave

These are valid follow-up issues, but are intentionally not in the first
community batch:

- Sign and notarize distributed artifacts — requires project-owner certificates
  and notarization credentials.
- Validate real Ubuntu `apt`/`dpkg` installation — needs a clean Ubuntu VM and
  install/upgrade evidence.
- Add OpenCode usage accounting — depends on the exact usage contract exposed
  by the supported OpenCode version.

## Stewardship invitation

A contributor does not need to implement an entire item alone. A reproduction,
fixture, documentation improvement, benchmark or design proposal is a useful
first contribution. Maintainers welcome a long-term steward who coordinates
issues and pull requests for one area while keeping the work open to the wider
community.
