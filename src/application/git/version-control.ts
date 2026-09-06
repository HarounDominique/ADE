import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type GitCommitFile = { status: string; path: string };
export type GitCommit = { hash: string; shortHash: string; author: string; date: string; subject: string; files: GitCommitFile[]; unpushed: boolean };

function parseCommitFiles(output: string): GitCommitFile[] {
  return output.split("\n").filter(Boolean).map((line) => {
    const fields = line.split("\t");
    return { status: fields[0] ?? "?", path: fields.at(-1) ?? "" };
  }).filter((file) => file.path.length > 0);
}

/** Commits the operator still owes the remote.  Without a remote nothing is
    pushable, so the set stays empty and Push origin remains inert. */
export async function listUnpushedCommits(directory: string): Promise<Set<string>> {
  const remotes = await execFile("git", ["remote"], { cwd: directory }).catch(() => ({ stdout: "" }));
  if (!remotes.stdout.trim()) return new Set();
  const upstream = await execFile("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { cwd: directory }).then((result) => result.stdout.trim()).catch(() => "");
  const args = upstream ? ["rev-list", `${upstream}..HEAD`] : ["rev-list", "HEAD", "--not", "--remotes"];
  const revisions = await execFile("git", args, { cwd: directory }).catch(() => ({ stdout: "" }));
  return new Set(revisions.stdout.split("\n").filter(Boolean));
}

export async function listGitCommits(directory: string, limit = 50): Promise<GitCommit[]> {
  const log = await execFile("git", ["log", `-${limit}`, "--format=%H%x09%h%x09%an%x09%aI%x09%s"], { cwd: directory });
  const unpushed = await listUnpushedCommits(directory);
  const commits: GitCommit[] = [];
  for (const line of log.stdout.split("\n").filter(Boolean)) {
    const [hash, shortHash, author, date, ...subjectParts] = line.split("\t");
    if (!hash || !shortHash || !author || !date) continue;
    const files = await execFile("git", ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "--find-renames", hash], { cwd: directory });
    commits.push({ hash, shortHash, author, date, subject: subjectParts.join("\t"), files: parseCommitFiles(files.stdout), unpushed: unpushed.has(hash) });
  }
  return commits;
}

export async function readGitCommitDiff(directory: string, commit: string, file?: string): Promise<{ commit: string; file?: string; diff: string }> {
  const args = ["show", "--format=", "--binary", "--find-renames", commit, "--"];
  if (file) args.push(file);
  const result = await execFile("git", args, { cwd: directory });
  return { commit, ...(file ? { file } : {}), diff: result.stdout };
}

export async function inspectPendingGitChanges(directory: string) {
  const [status, diff] = await Promise.all([
    execFile("git", ["status", "--short", "--untracked-files=all"], { cwd: directory }),
    execFile("git", ["diff", "HEAD", "--binary"], { cwd: directory }),
  ]);
  const files = status.stdout.split("\n").filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim() || "?", path: line.slice(3).trim() })).filter((file) => file.path.length > 0);
  return { files, diff: diff.stdout };
}

export async function readPendingGitDiff(directory: string, file: string): Promise<{ file: string; diff: string }> {
  const pending = await inspectPendingGitChanges(directory);
  if (!pending.files.some((candidate) => candidate.path === file)) throw new Error("The requested file is not pending in this repository");
  try {
    const result = await execFile("git", ["diff", "HEAD", "--binary", "--", file], { cwd: directory });
    if (result.stdout) return { file, diff: result.stdout };
  } catch (error) {
    const output = error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string" ? error.stdout : "";
    if (output) return { file, diff: output };
    throw error;
  }
  const result = await execFile("git", ["diff", "--no-index", "--binary", "/dev/null", file], { cwd: directory }).catch((error: unknown) => {
    const output = error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string" ? error.stdout : "";
    return { stdout: output };
  });
  return { file, diff: result.stdout };
}
