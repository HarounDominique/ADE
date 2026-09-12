import { executeGit, GitRepositoryMissingError, isInsideGitWorkTree } from "../../adapters/git-command.js";

export async function inspectGitWorkspace(directory: string) {
  if (!(await isInsideGitWorkTree(directory))) throw new GitRepositoryMissingError();
  const [branches, worktrees, remotes, currentBranch, status] = await Promise.all([
    executeGit(["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd: directory }),
    executeGit(["worktree", "list", "--porcelain"], { cwd: directory }),
    executeGit(["remote", "-v"], { cwd: directory }),
    executeGit(["branch", "--show-current"], { cwd: directory }),
    executeGit(["status", "--short"], { cwd: directory }),
  ]);
  const current = currentBranch.stdout.trim();
  const branchList = branches.stdout.split("\n").filter(Boolean);
  // A branch with no commit yet (just `git switch -c`-ed on a repository
  // with zero commits, or the repository's own default branch before its
  // first commit) has no ref under refs/heads at all -- for-each-ref never
  // lists it, even though it is genuinely the current branch.
  if (current && !branchList.includes(current)) branchList.push(current);
  return {
    currentBranch: current || "detached",
    changedFiles: status.stdout.split("\n").filter(Boolean),
    branches: branchList,
    worktrees: worktrees.stdout.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length)),
    remotes: remotes.stdout.split("\n").filter(Boolean),
  };
}
