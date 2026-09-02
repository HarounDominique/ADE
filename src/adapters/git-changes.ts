import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type GitChanges = {
  status: string;
  patch: string;
  untracked: readonly string[];
};

export async function captureGitChanges(directory: string): Promise<GitChanges> {
  const [statusResult, diffResult, untrackedResult] = await Promise.all([
    execFile("git", ["status", "--short"], { cwd: directory }),
    execFile("git", ["diff", "--binary"], { cwd: directory }),
    execFile("git", ["ls-files", "--others", "--exclude-standard"], { cwd: directory }),
  ]);
  return {
    status: statusResult.stdout,
    patch: diffResult.stdout,
    untracked: untrackedResult.stdout.split("\n").filter(Boolean),
  };
}
