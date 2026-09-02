import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/domain/task.js";
import { createChangeSet } from "../src/domain/change-set.js";
import { EvidenceReviewer } from "../src/adapters/evidence-reviewer.js";
import { reviewChangeSet } from "../src/application/review-change-set.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";

function changeSet(id: string, changed: boolean) {
  return createChangeSet({
    id,
    taskId: "task-review",
    sessionId: "session-implementation",
    runtimeDiff: changed ? [{ path: "new.txt" }] : [],
    git: changed
      ? { status: "?? new.txt\n", patch: "", untracked: ["new.txt"] }
      : { status: "", patch: "", untracked: [] },
  });
}

test("review pipeline uses fresh reviewer input and passes changed evidence", async () => {
  const task = Task.create({ id: "task-review", intent: "Create a useful change" });
  task.transition("READY", "Intent accepted", "human");
  task.transition("IN_PROGRESS", "Implementation started", "ade");
  task.transition("IMPLEMENTED", "ChangeSet captured", "ade");
  const store = new AdeStore();
  const captured = changeSet("changeset-review-1", true);
  store.saveTask(task);
  store.saveChangeSet(captured);
  const review = await reviewChangeSet(new EvidenceReviewer(), {
    task,
    changeSet: captured,
    store,
  });

  assert.equal(review.status, "pass");
  assert.equal(review.findings.length, 0);
  assert.equal(task.currentStatus, "READY_FOR_HUMAN");
  assert.equal(store.getReview(review.id)?.taskId, task.id);
  store.close();
});

test("review pipeline turns missing evidence into an actionable finding", async () => {
  const task = Task.create({ id: "task-review-2", intent: "Make a change" });
  task.transition("READY", "Intent accepted", "human");
  task.transition("IN_PROGRESS", "Implementation started", "ade");
  task.transition("IMPLEMENTED", "ChangeSet captured", "ade");

  const review = await reviewChangeSet(new EvidenceReviewer(), {
    task,
    changeSet: changeSet("changeset-review-2", false),
  });

  assert.equal(review.status, "pass");
  assert.equal(review.findings[0]?.action, "fix");
  assert.equal(task.currentStatus, "READY_FOR_HUMAN");
});
