import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { EvidenceReviewer } from "../src/adapters/evidence-reviewer.js";
import { runReviewFlow } from "../src/application/run-review-flow.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import type { AgentRuntimePort } from "../src/ports/agent-runtime.js";

const execFile = promisify(execFileCallback);

test("end-to-end flow persists Task, ChangeSet and Review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-review-flow-"));
  await execFile("git", ["init", "-q", directory]);
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
  const store = new AdeStore();
  const result = await runReviewFlow(runtime, new EvidenceReviewer(), {
    taskId: "task-e2e",
    directory,
    intent: "Create result.txt",
    acceptanceCriteria: ["result.txt exists and holds the expected line"],
    store,
  });

  assert.equal(result.review.status, "pass");
  assert.equal(result.implementation.task.currentStatus, "READY_FOR_HUMAN");
  assert.equal(store.getTask("task-e2e")?.status, "READY_FOR_HUMAN");
  assert.equal(store.getChangeSet("changeset-task-e2e")?.taskId, "task-e2e");
  assert.equal(store.getReview("review-changeset-task-e2e")?.changeSetId, "changeset-task-e2e");
  store.close();
});
