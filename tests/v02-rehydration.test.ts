import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { EvidenceReviewer } from "../src/adapters/evidence-reviewer.js";
import { runReviewFlow } from "../src/application/run-review-flow.js";
import { getTaskDetail } from "../src/application/task-detail.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import type { AgentRuntimePort } from "../src/ports/agent-runtime.js";

const execFile = promisify(execFileCallback);

test("v0.2 rehydrates Task, evidence, ChangeSet and Review after restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-v02-rehydrate-"));
  await execFile("git", ["init", "-q", directory]);
  const dbPath = join(directory, "ade.db");
  const file = join(directory, "result.txt");
  const runtime: AgentRuntimePort = {
    health: async () => ({ healthy: true }),
    createSession: async (input) => ({ id: `session-${input.title}`, directory: input.directory }),
    prompt: async () => { await writeFile(file, "created\n"); },
    promptAndWait: async () => ({ info: { structured: { summary: "unused", findings: [] } } }),
    events: async function* () { yield { type: "opencode.event", payload: { type: "session.idle" } }; },
    diff: async () => [],
    abort: async () => {},
  };
  const firstStore = new AdeStore(dbPath);
  const result = await runReviewFlow(runtime, new EvidenceReviewer(), { taskId: "task-rehydrate", directory, intent: "Create result.txt", store: firstStore });
  firstStore.saveRuntimeEvidence({ id: "evidence-rehydrate", taskId: result.implementation.taskId, type: "test", at: new Date().toISOString(), summary: "verification persisted" });
  firstStore.close();

  const restartedStore = new AdeStore(dbPath);
  const detail = getTaskDetail(restartedStore, "task-rehydrate");
  assert.equal(detail.task.status, "READY_FOR_HUMAN");
  assert.equal(detail.changeSets.length, 1);
  assert.equal(detail.reviews.length, 1);
  assert.equal(detail.runtimeEvidence.length, 1);
  assert.equal(restartedStore.listGates("task-rehydrate").length, 4);
  restartedStore.close();
});
