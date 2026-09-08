import { executeGit } from "../../adapters/git-command.js";

export async function inspectGitWorkspace(directory: string) {
  const [branches, worktrees, remotes, currentBranch, status] = await Promise.all([
    executeGit(["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd: directory }),
    executeGit(["worktree", "list", "--porcelain"], { cwd: directory }),
    executeGit(["remote", "-v"], { cwd: directory }),
    executeGit(["branch", "--show-current"], { cwd: directory }),
    executeGit(["status", "--short"], { cwd: directory }),
  ]);
  return {
    currentBranch: currentBranch.stdout.trim() || "detached",
    changedFiles: status.stdout.split("\n").filter(Boolean),
    branches: branches.stdout.split("\n").filter(Boolean),
    worktrees: worktrees.stdout.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length)),
    remotes: remotes.stdout.split("\n").filter(Boolean),
  };
}
