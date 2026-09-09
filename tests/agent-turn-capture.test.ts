import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { captureTurnChangeSet } from "../src/application/agents/capture-turn-change-set.js";

const execFile = promisify(execFileCallback);

async function repositoryWithTask(store: AdeStore, taskId: string) {
  const directory = await mkdtemp(join(tmpdir(), "ade-turn-capture-"));
  const git = (...args: string[]) => execFile("git", args, { cwd: directory });
  await git("init", "-q");
  await git("config", "user.email", "ade@example.test");
  await git("config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git("add", "README.md");
  await git("commit", "-qm", "docs: initial");
  const task = createTask(store, { id: taskId, intent: "Change something", repositoryPath: directory });
  task.transition("READY", "Acceptance criteria recorded", "human");
  store.saveTask(task);
  return { directory, git };
}

test("a turn that changed the repository enters the pipeline whichever provider ran it", async () => {
  const store = new AdeStore();
  const { directory } = await repositoryWithTask(store, "task-capture");
  await writeFile(join(directory, "README.md"), "changed by the agent\n");

  const capture = await captureTurnChangeSet(store, {
    taskId: "task-capture",
    sessionId: "claude-session",
    directory,
    turnId: "turn-1",
    provider: "claude",
    model: "opus",
    runtimeDiff: [{ path: "README.md", additions: 1, deletions: 1 }],
  });

  assert.ok(capture, "a turn with changes must produce a ChangeSet");
  assert.equal(capture.changeSet.sessionId, "claude-session");
  assert.match(capture.changeSet.git.status, /README\.md/);
  // The Task walks to IMPLEMENTED along transitions the workflow already allows.
  assert.equal(capture.taskStatus, "IMPLEMENTED");
  assert.equal(store.rehydrateTask("task-capture")?.currentStatus, "IMPLEMENTED");
  assert.equal(store.listChangeSets("task-capture").length, 1);
  const evidence = store.listRuntimeEvidence("task-capture", 10);
  assert.equal(evidence[0]?.type, "agent.turn");
  assert.match(evidence[0]?.summary ?? "", /claude \(opus\) changed 1 file/);
  store.close();
});

test("a turn that only read the repository leaves no ChangeSet behind", async () => {
  const store = new AdeStore();
  const { directory } = await repositoryWithTask(store, "task-readonly");

  const capture = await captureTurnChangeSet(store, {
    taskId: "task-readonly",
    sessionId: "codex-session",
    directory,
    turnId: "turn-1",
    provider: "codex",
    runtimeDiff: [],
  });

  // An empty ChangeSet would make the `build` gate pass for free.
  assert.equal(capture, undefined);
  assert.deepEqual(store.listChangeSets("task-readonly"), []);
  assert.deepEqual(store.listRuntimeEvidence("task-readonly", 10), []);
  assert.equal(store.rehydrateTask("task-readonly")?.currentStatus, "READY");
  store.close();
});

test("a second turn is recorded even when the Task cannot move again", async () => {
  const store = new AdeStore();
  const { directory } = await repositoryWithTask(store, "task-second");
  await writeFile(join(directory, "README.md"), "first pass\n");
  await captureTurnChangeSet(store, { taskId: "task-second", sessionId: "session-1", directory, turnId: "turn-1", provider: "codex", runtimeDiff: [] });
  await writeFile(join(directory, "notes.md"), "second pass\n");

  const second = await captureTurnChangeSet(store, { taskId: "task-second", sessionId: "session-1", directory, turnId: "turn-2", provider: "codex", runtimeDiff: [] });

  // IMPLEMENTED has no legal path back to IN_PROGRESS, and recording the
  // change never depends on being able to move the Task.
  assert.ok(second);
  assert.equal(second.taskStatus, "IMPLEMENTED");
  assert.equal(store.listChangeSets("task-second").length, 2);
  assert.deepEqual(store.listChangeSets("task-second").map((set) => set.id).sort(), ["changeset-task-second-turn-1", "changeset-task-second-turn-2"]);
  store.close();
});

test("a turn without a known Task captures nothing", async () => {
  const store = new AdeStore();
  const capture = await captureTurnChangeSet(store, { taskId: "task-missing", sessionId: "session-1", directory: tmpdir(), turnId: "turn-1", provider: "claude", runtimeDiff: [{ path: "a.ts" }] });
  assert.equal(capture, undefined);
  store.close();
});
