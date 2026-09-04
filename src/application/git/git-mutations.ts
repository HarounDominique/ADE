import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCallback);

type ConfirmedOperation = { directory: string; actor: string; reason: string; confirmed: boolean };
function assertConfirmed(input: ConfirmedOperation): void {
  if (!input.confirmed) throw new Error("Git mutation requires explicit confirmation");
  if (!input.actor.trim() || !input.reason.trim()) throw new Error("Git mutation requires actor and reason");
}

export async function createBranch(input: ConfirmedOperation & { name: string }) {
  assertConfirmed(input);
  await execFile("git", ["switch", "-c", input.name], { cwd: input.directory });
  return { operation: "branch.create", name: input.name, actor: input.actor, reason: input.reason };
}

export async function switchBranch(input: ConfirmedOperation & { branch: string }) {
  assertConfirmed(input);
  if (!input.branch.trim()) throw new Error("Cannot switch to an empty branch");
  await execFile("git", ["switch", input.branch], { cwd: input.directory });
  return { operation: "branch.switch", branch: input.branch, actor: input.actor, reason: input.reason };
}

export async function createWorktree(input: ConfirmedOperation & { path: string; branch: string }) {
  assertConfirmed(input);
  await execFile("git", ["worktree", "add", "-b", input.branch, input.path], { cwd: input.directory });
  return { operation: "worktree.create", path: input.path, branch: input.branch, actor: input.actor, reason: input.reason };
}

export async function createCommit(input: ConfirmedOperation & { message: string }) {
  assertConfirmed(input);
  await execFile("git", ["add", "--all"], { cwd: input.directory });
  const result = await execFile("git", ["commit", "-m", input.message], { cwd: input.directory });
  const commit = (await execFile("git", ["rev-parse", "HEAD"], { cwd: input.directory })).stdout.trim();
  return { operation: "commit.create", message: input.message, commit, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function createPullRequest(input: ConfirmedOperation & { title: string; body: string; base?: string }) {
  assertConfirmed(input);
  const result = await execFile("gh", ["pr", "create", "--title", input.title, "--body", input.body, ...(input.base ? ["--base", input.base] : [])], { cwd: input.directory });
  return { operation: "pull-request.create", url: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function pushBranch(input: ConfirmedOperation & { remote?: string; branch?: string }) {
  assertConfirmed(input);
  const branch = input.branch ?? (await execFile("git", ["branch", "--show-current"], { cwd: input.directory })).stdout.trim();
  if (!branch) throw new Error("Cannot push without a current branch");
  const result = await execFile("git", ["push", input.remote ?? "origin", branch], { cwd: input.directory });
  return { operation: "push", branch, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}
