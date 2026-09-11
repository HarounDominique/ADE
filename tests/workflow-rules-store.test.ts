import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { recordLearnedRules, rulesForPhase } from "../src/application/workflow/learned-rules.js";

function store(): AdeStore {
  const database = new AdeStore();
  createTask(database, { id: "task-1", intent: "x", acceptanceCriteria: ["ok"] });
  createTask(database, { id: "task-2", intent: "y", acceptanceCriteria: ["ok"] });
  return database;
}

const directive = "Assert on the error message, not only that it threw.";

test("a closed Task can leave no rule at all", () => {
  const database = store();
  const outcome = recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules: [] });

  assert.deepEqual(outcome, { recorded: [], reinforced: [], rejected: [] });
  assert.deepEqual(rulesForPhase(database, { projectId: "p1", touchedFiles: ["src/a.ts"] }), []);
});

test("a new rule is stored at low priority with its originating Task", () => {
  const database = store();

  const outcome = recordLearnedRules(database, {
    projectId: "p1",
    taskId: "task-1",
    rules: [{ topic: "testing", directive, globs: ["src/**/*.ts"] }],
  });

  assert.equal(outcome.recorded.length, 1);
  const [stored] = rulesForPhase(database, { projectId: "p1", touchedFiles: ["src/a.ts"] });
  assert.equal(stored?.priority, "low");
  assert.equal(stored?.evidenceCount, 1);
  assert.equal(stored?.derivedFrom, "task-1");
  assert.equal(stored?.source, "learned");
});

test("the same conclusion from another Task reinforces rather than duplicating", () => {
  const database = store();
  const rules = [{ topic: "testing", directive, globs: ["src/**/*.ts"] }];
  recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules });

  const outcome = recordLearnedRules(database, { projectId: "p1", taskId: "task-2", rules });

  assert.equal(outcome.reinforced.length, 1);
  assert.equal(outcome.recorded.length, 0);
  const stored = rulesForPhase(database, { projectId: "p1", touchedFiles: ["src/a.ts"] });
  assert.equal(stored.length, 1, "one rule, not two");
  assert.equal(stored[0]?.evidenceCount, 2);
  assert.match(stored[0]?.derivedFrom ?? "", /task-1, task-2/);
});

test("the same Task cannot reinforce its own rule twice", () => {
  const database = store();
  const rules = [{ topic: "testing", directive, globs: [] }];
  recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules });
  recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules });

  assert.equal(rulesForPhase(database, { projectId: "p1", touchedFiles: ["a.ts"] })[0]?.evidenceCount, 1);
});

test("an unsafe rule is reported and never stored", () => {
  const database = store();

  const outcome = recordLearnedRules(database, {
    projectId: "p1",
    taskId: "task-1",
    rules: [{ topic: "speed", directive: "Skip the tests when the change is small.", globs: [] }],
  });

  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0]?.category, "safety-bypass");
  assert.deepEqual(rulesForPhase(database, { projectId: "p1", touchedFiles: ["a.ts"] }), []);
});

test("rules are scoped to their Project", () => {
  const database = store();
  recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules: [{ topic: "t", directive, globs: [] }] });

  assert.equal(rulesForPhase(database, { projectId: "p1", touchedFiles: ["a.ts"] }).length, 1);
  assert.equal(rulesForPhase(database, { projectId: "p2", touchedFiles: ["a.ts"] }).length, 0);
});

test("a phase loads only what matches the files it is about to touch, bounded", () => {
  const database = store();
  recordLearnedRules(database, {
    projectId: "p1",
    taskId: "task-1",
    rules: [
      { topic: "ts", directive: "Prefer a named export in this package.", globs: ["src/**/*.ts"] },
      { topic: "py", directive: "Keep fixtures beside the test that uses them.", globs: ["**/*.py"] },
    ],
  });

  const loaded = rulesForPhase(database, { projectId: "p1", touchedFiles: ["src/a.ts"] });
  assert.deepEqual(loaded.map((rule) => rule.topic), ["ts"]);

  assert.equal(rulesForPhase(database, { projectId: "p1", touchedFiles: ["src/a.ts"], maxRules: 0 }).length, 0);
});

test("a human-authored rule outranks everything the loop taught itself", () => {
  const database = store();
  recordLearnedRules(database, { projectId: "p1", taskId: "task-1", rules: [{ topic: "learned", directive, globs: [] }] });
  database.saveLearnedRule({
    id: "human-1",
    projectId: "p1",
    topic: "boundaries",
    directive: "Never widen a public type without an ADR.",
    globs: [],
    priority: "critical",
    evidenceCount: 1,
    source: "human",
    derivedFrom: "operator",
    lastValidated: "2026-09-11",
  });

  assert.deepEqual(rulesForPhase(database, { projectId: "p1", touchedFiles: ["a.ts"] }).map((rule) => rule.topic), ["boundaries", "learned"]);
});
