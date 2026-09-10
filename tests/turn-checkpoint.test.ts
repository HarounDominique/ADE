import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { CheckpointBlockedError, captureTurnCheckpoint, restoreTaskCheckpoint } from "../src/application/agents/task-checkpoints.js";
import { CheckpointUnavailableError, createTurnCheckpoint, restoreTurnCheckpoint, turnWrites } from "../src/application/agents/turn-checkpoint.js";

const execFile = promisify(execFileCallback);

async function repositoryWithWork() {
  const directory = await mkdtemp(join(tmpdir(), "ade-checkpoint-"));
  const git = (...args: string[]) => execFile("git", args, { cwd: directory });
  await git("init", "-q");
  await git("config", "user.email", "operator@example.test");
  await git("config", "user.name", "Operator");
  await writeFile(join(directory, "README.md"), "first\n");
  await git("add", "README.md");
  await git("commit", "-qm", "docs: initial");
  // What the operator had before the turn: a tracked edit, something staged
  // and an untracked file. All three are theirs, and all three must come back.
  await writeFile(join(directory, "README.md"), "edited by the operator\n");
  await writeFile(join(directory, "staged.txt"), "staged by the operator\n");
  await git("add", "staged.txt");
  await writeFile(join(directory, "scratch.txt"), "untracked but mine\n");
  return { directory, git };
}

test("a writing turn is the only one that leaves a way back", () => {
  assert.equal(turnWrites(["write_code"]), true);
  assert.equal(turnWrites(["write_docs"]), true);
  assert.equal(turnWrites(["read_project", "run_commands"]), false);
  assert.equal(turnWrites(undefined), false);
});

test("a checkpoint photographs the working tree without touching the operator's history", async () => {
  const { directory, git } = await repositoryWithWork();
  const { stdout: headBefore } = await git("rev-parse", "HEAD");
  const { stdout: statusBefore } = await git("status", "--short");

  const checkpoint = await createTurnCheckpoint({ directory, label: "claude turn 1" });

  // Three files are in the photograph: tracked, staged and untracked alike.
  assert.equal(checkpoint.files, 3);
  const { stdout: headAfter } = await git("rev-parse", "HEAD");
  assert.equal(headAfter, headBefore, "the checkpoint must not commit onto the operator's branch");
  const { stdout: statusAfter } = await git("status", "--short");
  assert.equal(statusAfter, statusBefore, "the checkpoint must leave the index exactly as the operator staged it");
  const { stdout: count } = await git("rev-list", "--count", "HEAD");
  assert.equal(count.trim(), "1");
  // The ref is what keeps the way back alive against garbage collection.
  const { stdout: ref } = await git("rev-parse", checkpoint.ref);
  assert.equal(ref.trim(), checkpoint.commit);
  const { stdout: author } = await git("log", "-1", "--format=%an", checkpoint.commit);
  assert.equal(author.trim(), "ADE", "a checkpoint is ADE's, never signed with the operator's identity");

  await rm(directory, { recursive: true, force: true });
});

test("restoring puts back what the turn changed, deleted and added", async () => {
  const { directory, git } = await repositoryWithWork();
  const checkpoint = await createTurnCheckpoint({ directory, label: "codex turn 1" });

  // The turn rewrites a file, deletes another and leaves a new one behind.
  await writeFile(join(directory, "README.md"), "rewritten by the agent\n");
  await rm(join(directory, "scratch.txt"));
  await mkdir(join(directory, "src"), { recursive: true });
  await writeFile(join(directory, "src", "invented.ts"), "export const invented = true;\n");

  const restore = await restoreTurnCheckpoint({ directory, commit: checkpoint.commit });

  assert.equal(await readFile(join(directory, "README.md"), "utf8"), "edited by the operator\n");
  assert.equal(await readFile(join(directory, "scratch.txt"), "utf8"), "untracked but mine\n");
  assert.equal(existsSync(join(directory, "src", "invented.ts")), false, "a file the turn invented does not survive the way back");
  assert.deepEqual([...restore.removed], ["src/invented.ts"]);
  // Undoing the undo is possible because the restore photographed what it threw away.
  const { stdout: undo } = await git("show", `${restore.previous.commit}:src/invented.ts`);
  assert.equal(undo, "export const invented = true;\n");
  const { stdout: count } = await git("rev-list", "--count", "HEAD");
  assert.equal(count.trim(), "1", "restoring creates no commit on the operator's branch");

  await rm(directory, { recursive: true, force: true });
});

test("a directory outside a repository says it cannot hold a way back", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-checkpoint-none-"));
  await assert.rejects(createTurnCheckpoint({ directory, label: "claude turn 1" }), CheckpointUnavailableError);
  await rm(directory, { recursive: true, force: true });
});

test("a turn that only reads leaves no checkpoint, and a writing one leaves it on the Task", async () => {
  const store = new AdeStore();
  const { directory } = await repositoryWithWork();
  createTask(store, { id: "task-checkpoint", intent: "Change the readme", repositoryPath: directory });

  const readOnly = await captureTurnCheckpoint(store, { taskId: "task-checkpoint", provider: "claude", directory, turnId: "turn-1", grantedPermissions: ["read_project"] });
  assert.equal(readOnly, undefined);
  assert.deepEqual(store.listTaskCheckpoints("task-checkpoint"), []);

  const checkpoint = await captureTurnCheckpoint(store, { taskId: "task-checkpoint", sessionId: "session-1", provider: "claude", directory, turnId: "turn-2", grantedPermissions: ["read_project", "write_code"] });
  assert.ok(checkpoint);
  assert.equal(store.listTaskCheckpoints("task-checkpoint")[0]?.commit, checkpoint.commit);
  assert.equal(store.listTaskCheckpoints("task-checkpoint")[0]?.restoredAt, undefined);

  await rm(directory, { recursive: true, force: true });
});

test("going back needs an explicit confirmation and is recorded against the Task", async () => {
  const store = new AdeStore();
  const { directory } = await repositoryWithWork();
  createTask(store, { id: "task-restore", intent: "Change the readme", repositoryPath: directory });
  const checkpoint = await captureTurnCheckpoint(store, { taskId: "task-restore", sessionId: "session-1", provider: "codex", directory, turnId: "turn-1", grantedPermissions: ["write_code"] });
  assert.ok(checkpoint);
  await writeFile(join(directory, "README.md"), "rewritten by the agent\n");

  await assert.rejects(
    restoreTaskCheckpoint(store, { checkpointId: checkpoint.id, actor: "human", reason: "Undo the turn", confirmed: false }),
    CheckpointBlockedError,
  );
  assert.equal(await readFile(join(directory, "README.md"), "utf8"), "rewritten by the agent\n");

  const restored = await restoreTaskCheckpoint(store, { checkpointId: checkpoint.id, actor: "human", reason: "Undo the turn", confirmed: true });

  assert.equal(await readFile(join(directory, "README.md"), "utf8"), "edited by the operator\n");
  assert.equal(store.getTaskCheckpoint(checkpoint.id)?.restoredAt !== undefined, true);
  // The undo of the undo is listed beside the rest, not left in the reflog.
  assert.equal(store.listTaskCheckpoints("task-restore").some((item) => item.commit === restored.previousCommit), true);
  const operations = store.listGitOperations("task-restore");
  assert.equal(operations[0]?.operation, "checkpoint.restore");
  assert.equal(operations[0]?.reference, checkpoint.commit);
  assert.equal(store.listRuntimeEvidence("task-restore").some((item) => item.type === "checkpoint.restore"), true);

  await rm(directory, { recursive: true, force: true });
});

test("a checkpoint on a repository without a first commit still has a way back", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-checkpoint-empty-"));
  await execFile("git", ["init", "-q"], { cwd: directory });
  await writeFile(join(directory, "draft.md"), "before the first commit\n");

  const checkpoint = await createTurnCheckpoint({ directory, label: "claude turn 1" });
  await rm(join(directory, "draft.md"));
  await restoreTurnCheckpoint({ directory, commit: checkpoint.commit });

  assert.equal(await readFile(join(directory, "draft.md"), "utf8"), "before the first commit\n");
  await rm(directory, { recursive: true, force: true });
});

test("a checkpoint returns the bytes the operator wrote, not Git's idea of them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-checkpoint-crlf-"));
  const git = (...args: string[]) => execFile("git", args, { cwd: directory });
  await git("init", "-q");
  await git("config", "user.email", "operator@example.test");
  await git("config", "user.name", "Operator");
  // Git for Windows turns this on when it installs, so this is the ordinary
  // configuration there rather than an exotic one.
  await git("config", "core.autocrlf", "true");
  await writeFile(join(directory, "unix.txt"), "line one\nline two\n");
  await writeFile(join(directory, "windows.txt"), "line one\r\nline two\r\n");

  const checkpoint = await createTurnCheckpoint({ directory, label: "claude turn 1" });
  await writeFile(join(directory, "unix.txt"), "rewritten by the agent\n");
  await rm(join(directory, "windows.txt"));
  await restoreTurnCheckpoint({ directory, commit: checkpoint.commit });

  // A restore that changes a byte the operator never touched is not a way back.
  assert.equal(await readFile(join(directory, "unix.txt"), "utf8"), "line one\nline two\n");
  assert.equal(await readFile(join(directory, "windows.txt"), "utf8"), "line one\r\nline two\r\n");

  await rm(directory, { recursive: true, force: true });
});
