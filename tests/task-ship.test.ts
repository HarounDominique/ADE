import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { approveTaskFromStore } from "../src/application/tasks/approval-from-store.js";
import { ShipBlockedError, shipTaskFromStore } from "../src/application/tasks/ship-from-store.js";
import { createChangeSet } from "../src/domain/change-set.js";
import { createRuntimeEvidence } from "../src/domain/runtime-evidence.js";
import { createReview } from "../src/domain/review.js";

const execFile = promisify(execFileCallback);

async function repositoryReadyToShip(store: AdeStore, taskId: string, { approve = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "ade-ship-"));
  const git = (...args: string[]) => execFile("git", args, { cwd: directory });
  await git("init", "-q");
  await git("config", "user.email", "ade@example.test");
  await git("config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git("add", "README.md");
  await git("commit", "-qm", "docs: initial");
  await writeFile(join(directory, "README.md"), "changed by the agent\n");

  const task = createTask(store, { id: taskId, intent: "Change the readme", repositoryPath: directory, acceptanceCriteria: ["The readme states the change"] });
  task.transition("READY", "Acceptance criteria recorded", "human");
  task.transition("IN_PROGRESS", "Agent started", "ade");
  task.transition("IMPLEMENTED", "Agent captured a ChangeSet", "ade");
  task.transition("UNDER_REVIEW", "Reviewer started", "ade");
  task.transition("READY_FOR_HUMAN", "Reviewer passed", "ade");
  store.saveTask(task);
  const changeSet = createChangeSet({ id: `changeset-${taskId}`, taskId, sessionId: "agent-session", directory, runtimeDiff: [], git: { status: " M README.md", patch: "", untracked: [] } });
  store.saveChangeSet(changeSet);
  for (const type of ["verification.build.pass", "verification.tests.pass", "documentation.reconciled"]) {
    store.saveRuntimeEvidence(createRuntimeEvidence({ id: `runtime-${taskId}-${type}`, taskId, type, summary: type, at: "2026-09-09T10:00:00.000Z" }));
  }
  store.saveReview(createReview({ id: `review-${taskId}`, taskId, changeSet, reviewer: "opencode", summary: "No findings", findings: [] }));
  if (approve) approveTaskFromStore(store, { id: taskId, reason: "Human approval confirmed", actor: "human" });
  return { directory, git };
}

test("shipping publishes the approved work and links the commit to the Task", async () => {
  const store = new AdeStore();
  const { directory, git } = await repositoryReadyToShip(store, "task-ship");

  const shipped = await shipTaskFromStore(store, { taskId: "task-ship", message: "docs: ship the readme change", actor: "human", reason: "Approved in Assay" });

  assert.equal(shipped.operation, "commit.create");
  const { stdout: subject } = await git("log", "-1", "--pretty=%s");
  assert.equal(subject.trim(), "docs: ship the readme change");
  // The trail from intent to published change survives outside ADE's memory.
  const operations = store.listGitOperations("task-ship");
  assert.equal(operations[0]?.reference, shipped.commit);
  assert.equal(operations[0]?.operation, "commit.create");
  const { stdout: pending } = await execFile("git", ["status", "--short"], { cwd: directory });
  assert.equal(pending.trim(), "");
  store.close();
});

test("shipping refuses without human approval", async () => {
  const store = new AdeStore();
  await repositoryReadyToShip(store, "task-unapproved", { approve: false });

  await assert.rejects(
    shipTaskFromStore(store, { taskId: "task-unapproved", message: "docs: ship", actor: "human", reason: "Attempt" }),
    (error: unknown) => error instanceof ShipBlockedError && /Human approval is required/.test((error as Error).message),
  );
  store.close();
});

test("shipping refuses while a required gate is not passed", async () => {
  const store = new AdeStore();
  await repositoryReadyToShip(store, "task-gated");
  // A verification that failed after approval still blocks publication.
  store.saveRuntimeEvidence(createRuntimeEvidence({ id: "runtime-task-gated-fail", taskId: "task-gated", type: "verification.tests.fail", summary: "npm · test exited 1", at: "2026-09-09T11:00:00.000Z" }));

  await assert.rejects(
    shipTaskFromStore(store, { taskId: "task-gated", message: "docs: ship", actor: "human", reason: "Attempt" }),
    (error: unknown) => error instanceof ShipBlockedError && /tests/.test((error as Error).message),
  );
  store.close();
});

test("shipping refuses when the working tree has nothing to publish", async () => {
  const store = new AdeStore();
  const { git } = await repositoryReadyToShip(store, "task-clean");
  await git("checkout", "--", "README.md");

  await assert.rejects(
    shipTaskFromStore(store, { taskId: "task-clean", message: "docs: ship", actor: "human", reason: "Attempt" }),
    (error: unknown) => error instanceof ShipBlockedError && /nothing to commit/.test((error as Error).message),
  );
  store.close();
});
