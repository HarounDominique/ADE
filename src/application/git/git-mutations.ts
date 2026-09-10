import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { executeGit } from "../../adapters/git-command.js";

const execFile = promisify(execFileCallback);

type ConfirmedOperation = { directory: string; actor: string; reason: string; confirmed: boolean };
function assertConfirmed(input: ConfirmedOperation): void {
  if (!input.confirmed) throw new Error("Git mutation requires explicit confirmation");
  if (!input.actor.trim() || !input.reason.trim()) throw new Error("Git mutation requires actor and reason");
}

export async function createBranch(input: ConfirmedOperation & { name: string }) {
  assertConfirmed(input);
  await executeGit(["switch", "-c", input.name], { cwd: input.directory });
  return { operation: "branch.create", name: input.name, actor: input.actor, reason: input.reason };
}

export async function switchBranch(input: ConfirmedOperation & { branch: string }) {
  assertConfirmed(input);
  if (!input.branch.trim()) throw new Error("Cannot switch to an empty branch");
  await executeGit(["switch", input.branch], { cwd: input.directory });
  return { operation: "branch.switch", branch: input.branch, actor: input.actor, reason: input.reason };
}

export async function createWorktree(input: ConfirmedOperation & { path: string; branch: string }) {
  assertConfirmed(input);
  await executeGit(["worktree", "add", "-b", input.branch, input.path], { cwd: input.directory });
  return { operation: "worktree.create", path: input.path, branch: input.branch, actor: input.actor, reason: input.reason };
}

export async function createCommit(input: ConfirmedOperation & { message: string; body?: string }) {
  assertConfirmed(input);
  await executeGit(["add", "--all"], { cwd: input.directory });
  const result = await executeGit(["commit", "-m", input.message, ...(input.body ? ["-m", input.body] : [])], { cwd: input.directory });
  const commit = (await executeGit(["rev-parse", "HEAD"], { cwd: input.directory })).stdout.trim();
  return { operation: "commit.create", message: input.message, commit, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function commitAndPush(input: ConfirmedOperation & { message: string; body?: string }) {
  assertConfirmed(input);
  const commit = await createCommit(input);
  const push = await pushBranch(input);
  return { operation: "commit.push", commit: commit.commit, branch: push.branch, output: `${commit.output}\n${push.output}`.trim(), actor: input.actor, reason: input.reason };
}

export async function fetchOrigin(input: ConfirmedOperation & { remote?: string }) {
  assertConfirmed(input);
  const result = await executeGit(["fetch", input.remote ?? "origin"], { cwd: input.directory });
  return { operation: "fetch.origin", output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function createPullRequest(input: ConfirmedOperation & { title: string; body: string; base?: string }) {
  assertConfirmed(input);
  const result = await execFile("gh", ["pr", "create", "--title", input.title, "--body", input.body, ...(input.base ? ["--base", input.base] : [])], { cwd: input.directory, windowsHide: true });
  return { operation: "pull-request.create", url: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function pushBranch(input: ConfirmedOperation & { remote?: string; branch?: string }) {
  assertConfirmed(input);
  const branch = input.branch ?? (await executeGit(["branch", "--show-current"], { cwd: input.directory })).stdout.trim();
  if (!branch) throw new Error("Cannot push without a current branch");
  const result = await executeGit(["push", input.remote ?? "origin", branch], { cwd: input.directory });
  return { operation: "push", branch, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}
