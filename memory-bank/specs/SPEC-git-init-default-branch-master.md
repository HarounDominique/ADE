# SPEC: Assay's Git init always creates `master`

status: approved

## Objective

Assay's "Initialize Git repository" action (`initializeRepository`,
`src/application/git/git-mutations.ts`) runs bare `git init`, which inherits whatever
the operator's own global `init.defaultBranch` config says — on at least one machine
this produced `main` instead of the classic `master` convention this project's own
`projectConfig.md` already uses (`protected_branches: [master]`, `pr_target: master`).
Pin Assay's own auto-init to `master` explicitly, regardless of the operator's global
git config, by passing `--initial-branch=master` to the `git init` call.

## Boundaries

**Always:** `git init` in `initializeRepository` always passes
`--initial-branch=master` — never relies on the operator's `init.defaultBranch` or
Git's own compiled-in default.

**Never:** never touches an *existing* repository's branch name or default branch —
this only affects the initial branch of a repository Assay itself creates via this one
action.
