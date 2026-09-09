import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/domain/task.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask, setTaskAcceptance } from "../src/application/tasks/task-commands.js";
import { getTaskDetail } from "../src/application/task-detail.js";
import { composeAgentPrompt } from "../src/application/structural-context/ask-briefing.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";

test("work does not start against an unstated definition of done", () => {
  const bare = Task.create({ id: "task-bare", intent: "Change the readme" });

  assert.throws(() => bare.transition("READY", "Intent accepted", "human"), /at least one acceptance criterion/);
  // Abandoning a Task never needed criteria; only committing to work does.
  bare.transition("ABORTED", "Not worth doing", "human");

  const framed = Task.create({ id: "task-framed", intent: "Change the readme", acceptanceCriteria: ["The readme names the new command", " ", "The command is covered by a test"] });
  // Blank lines are what a textarea produces, not criteria.
  assert.deepEqual(framed.acceptance(), ["The readme names the new command", "The command is covered by a test"]);
  framed.transition("READY", "Intent and acceptance accepted", "human");
  assert.equal(framed.currentStatus, "READY");
});

test("changing what done means is recorded, not silently overwritten", () => {
  const task = Task.create({ id: "task-change", intent: "Change the readme", acceptanceCriteria: ["The readme names the new command"] });

  task.setAcceptance(["The readme names the new command", "The command is covered by a test"], "The reviewer asked for a test", "human");

  assert.equal(task.acceptance().length, 2);
  const event = task.history().at(-1);
  assert.equal(event?.type, "task.acceptance_changed");
  assert.equal(event?.reason, "The reviewer asked for a test");
  assert.equal(event?.actor, "human");
  // Emptying the bar is not a way of lowering it.
  assert.throws(() => task.setAcceptance([], "No longer needed", "human"), /at least one acceptance criterion/);
  assert.throws(() => task.setAcceptance(["Something"], "", "human"), /requires a reason/);
});

test("criteria survive a round trip and a Task written before them stays readable", () => {
  const store = new AdeStore();
  createTask(store, { id: "task-persist", intent: "Change the readme", acceptanceCriteria: ["The readme names the new command"] });

  assert.deepEqual(store.rehydrateTask("task-persist")?.acceptance(), ["The readme names the new command"]);
  assert.deepEqual(getTaskDetail(store, "task-persist").task.acceptanceCriteria, ["The readme names the new command"]);

  // A row from before the column existed carries a null, not a list.
  store.db.prepare("UPDATE tasks SET acceptance_json = NULL WHERE id = ?").run("task-persist");
  assert.deepEqual(store.rehydrateTask("task-persist")?.acceptance(), []);

  setTaskAcceptance(store, { id: "task-persist", criteria: ["The command is covered by a test"], reason: "Framed after the fact" });
  assert.deepEqual(store.rehydrateTask("task-persist")?.acceptance(), ["The command is covered by a test"]);
});

test("an agent working on a Task is shown the bar it will be judged against", () => {
  const prompt = composeAgentPrompt(undefined, "Add the command", ["The readme names the new command", "The command is covered by a test"]);

  assert.match(prompt, /Acceptance criteria for this Task, which this work will be reviewed against:/);
  assert.match(prompt, /1\. The readme names the new command/);
  assert.match(prompt, /2\. The command is covered by a test/);
  // The operator's own prompt is still the last thing the agent reads.
  assert.match(prompt, /Add the command$/);
  // A Task without criteria adds nothing rather than an empty heading.
  assert.equal(composeAgentPrompt(undefined, "Add the command", []), "Add the command");
  assert.equal(composeAgentPrompt("Structural briefing", "Add the command"), "Structural briefing\n\nAdd the command");
});

test("the shell can record and change acceptance criteria through the sidecar", () => {
  const store = new AdeStore();

  const created = handleDesktopRequest(store, { id: "1", method: "task.create", params: { taskId: "task-sidecar", intent: "Change the readme", projectId: "ade", acceptanceCriteria: ["The readme names the new command"] } });
  assert.deepEqual((created.result as { acceptanceCriteria?: string[] }).acceptanceCriteria, ["The readme names the new command"]);

  const changed = handleDesktopRequest(store, { id: "2", method: "task.acceptance", params: { taskId: "task-sidecar", acceptanceCriteria: ["The command is covered by a test"], reason: "Reviewer asked for a test", actor: "human" } });
  assert.deepEqual((changed.result as { acceptanceCriteria?: string[] }).acceptanceCriteria, ["The command is covered by a test"]);

  const empty = handleDesktopRequest(store, { id: "3", method: "task.acceptance", params: { taskId: "task-sidecar", acceptanceCriteria: [] } });
  assert.equal(empty.error?.code, "INVALID_PARAMS");

  // A Task created without criteria refuses to become READY, and says why.
  handleDesktopRequest(store, { id: "4", method: "task.create", params: { taskId: "task-unframed", intent: "Change the readme", projectId: "ade" } });
  const advanced = handleDesktopRequest(store, { id: "5", method: "task.advance", params: { taskId: "task-unframed", next: "READY", reason: "Start work", actor: "human" } });
  assert.match(advanced.error?.message ?? "", /at least one acceptance criterion/);
});
