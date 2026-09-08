import { executeGit } from "./git-command.js";

export type GitChanges = {
  status: string;
  patch: string;
  untracked: readonly string[];
};

export async function captureGitChanges(directory: string): Promise<GitChanges> {
  const [statusResult, diffResult, untrackedResult] = await Promise.all([
    executeGit(["status", "--short"], { cwd: directory }),
    executeGit(["diff", "--binary"], { cwd: directory }),
    executeGit(["ls-files", "--others", "--exclude-standard"], { cwd: directory }),
  ]);
  return {
    status: statusResult.stdout,
    patch: diffResult.stdout,
    untracked: untrackedResult.stdout.split("\n").filter(Boolean),
  };
}
