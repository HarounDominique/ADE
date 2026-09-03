import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCallback);

export async function inspectGitWorkspace(directory: string) {
  const [branches, worktrees, remotes, currentBranch, status] = await Promise.all([
    execFile("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd: directory }),
    execFile("git", ["worktree", "list", "--porcelain"], { cwd: directory }),
    execFile("git", ["remote", "-v"], { cwd: directory }),
    execFile("git", ["branch", "--show-current"], { cwd: directory }),
    execFile("git", ["status", "--short"], { cwd: directory }),
  ]);
  return {
    currentBranch: currentBranch.stdout.trim() || "detached",
    changedFiles: status.stdout.split("\n").filter(Boolean),
    branches: branches.stdout.split("\n").filter(Boolean),
    worktrees: worktrees.stdout.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length)),
    remotes: remotes.stdout.split("\n").filter(Boolean),
  };
}
