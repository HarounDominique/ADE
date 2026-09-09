import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { getTaskDetail } from "../src/application/task-detail.js";

function storeWithConversation(taskId?: string) {
  const store = new AdeStore();
  if (taskId) createTask(store, { id: taskId, intent: "Change the readme", repositoryPath: "/tmp/ade-usage" });
  store.saveAgentSession({ id: "session-1", provider: "claude", directory: "/tmp/ade-usage", ...(taskId ? { taskId } : {}), status: "COMPLETED", createdAt: "2026-09-09T10:00:00.000Z" });
  return store;
}

test("a conversation reports what its turns consumed, cache told apart", () => {
  const store = storeWithConversation();
  store.saveAgentTurnUsage({ id: "usage-1", sessionId: "session-1", provider: "claude", model: "sonnet", inputTokens: 1_000, outputTokens: 200, cacheReadInputTokens: 4_000, cacheCreationInputTokens: 500, costUsd: 0.02, createdAt: "2026-09-09T10:01:00.000Z" });
  store.saveAgentTurnUsage({ id: "usage-2", sessionId: "session-1", provider: "claude", model: "sonnet", inputTokens: 300, outputTokens: 90, cacheReadInputTokens: 6_000, cacheCreationInputTokens: 0, costUsd: 0.01, createdAt: "2026-09-09T10:02:00.000Z" });

  const totals = store.agentSessionUsageTotals("session-1");

  assert.equal(totals?.turns, 2);
  assert.equal(totals?.inputTokens, 1_300);
  assert.equal(totals?.outputTokens, 290);
  // Cache is never folded into the input figure: it is not what was paid for.
  assert.equal(totals?.cacheReadInputTokens, 10_000);
  assert.equal(totals?.cacheCreationInputTokens, 500);
  assert.equal(totals?.costUsd?.toFixed(2), "0.03");
  assert.deepEqual(totals?.models, ["sonnet"]);
});

test("a conversation nobody accounted for is unknown, never zero", () => {
  const store = storeWithConversation();
  assert.equal(store.agentSessionUsageTotals("session-1"), undefined);
  assert.equal(store.taskUsageTotals("task-nothing"), undefined);
});

test("a turn without a declared cost leaves the total unpriced rather than free", () => {
  const store = storeWithConversation();
  store.saveAgentTurnUsage({ id: "usage-1", sessionId: "session-1", provider: "codex", inputTokens: 800, outputTokens: 120, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, createdAt: "2026-09-09T10:01:00.000Z" });

  const totals = store.agentSessionUsageTotals("session-1");

  assert.equal(totals?.turns, 1);
  assert.equal(totals?.turnsWithCost, 0);
  assert.equal("costUsd" in (totals ?? {}), false);
  assert.deepEqual(totals?.providers, ["codex"]);
});

test("a priced turn beside an unpriced one says how much of the total is priced", () => {
  const store = storeWithConversation();
  store.saveAgentTurnUsage({ id: "usage-1", sessionId: "session-1", provider: "claude", inputTokens: 100, outputTokens: 10, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUsd: 0.05, createdAt: "2026-09-09T10:01:00.000Z" });
  store.saveAgentTurnUsage({ id: "usage-2", sessionId: "session-1", provider: "claude", inputTokens: 100, outputTokens: 10, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, createdAt: "2026-09-09T10:02:00.000Z" });

  const totals = store.agentSessionUsageTotals("session-1");

  assert.equal(totals?.turns, 2);
  assert.equal(totals?.turnsWithCost, 1);
  assert.equal(totals?.costUsd, 0.05);
});

test("a Task adds up every conversation held under it", () => {
  const store = storeWithConversation("task-usage");
  store.saveAgentSession({ id: "session-2", provider: "codex", directory: "/tmp/ade-usage", taskId: "task-usage", status: "COMPLETED", createdAt: "2026-09-09T11:00:00.000Z" });
  store.saveAgentSession({ id: "session-elsewhere", provider: "claude", directory: "/tmp/ade-usage", status: "COMPLETED", createdAt: "2026-09-09T11:00:00.000Z" });
  store.saveAgentTurnUsage({ id: "usage-1", sessionId: "session-1", provider: "claude", model: "sonnet", inputTokens: 100, outputTokens: 10, cacheReadInputTokens: 20, cacheCreationInputTokens: 0, costUsd: 0.01, createdAt: "2026-09-09T10:01:00.000Z" });
  store.saveAgentTurnUsage({ id: "usage-2", sessionId: "session-2", provider: "codex", model: "gpt-5.6", inputTokens: 400, outputTokens: 40, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, createdAt: "2026-09-09T11:01:00.000Z" });
  // A conversation outside the Task is not part of what the Task cost.
  store.saveAgentTurnUsage({ id: "usage-3", sessionId: "session-elsewhere", provider: "claude", inputTokens: 9_000, outputTokens: 9_000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, createdAt: "2026-09-09T11:02:00.000Z" });

  const totals = store.taskUsageTotals("task-usage");

  assert.equal(totals?.turns, 2);
  assert.equal(totals?.inputTokens, 500);
  assert.equal(totals?.outputTokens, 50);
  assert.deepEqual([...(totals?.providers ?? [])].sort(), ["claude", "codex"]);
  // The Task's own detail is where the operator reads it.
  assert.equal(getTaskDetail(store, "task-usage").usage?.turns, 2);
});

test("a Task whose turns were never accounted for reads as unknown in its detail", () => {
  const store = storeWithConversation("task-silent");
  assert.equal(getTaskDetail(store, "task-silent").usage, null);
});
