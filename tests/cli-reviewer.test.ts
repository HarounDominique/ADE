import test from "node:test";
import assert from "node:assert/strict";
import { CliReviewer } from "../src/adapters/cli-reviewer.js";
import { OpenCodeReviewer } from "../src/adapters/opencode-reviewer.js";
import { buildReviewPrompt, parseReviewPayload } from "../src/adapters/review-contract.js";
import { createReviewer, isAgentProvider } from "../src/adapters/provider-runtime.js";
import { reviewProvider } from "../src/desktop-sidecar.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import type { AgentRuntimePort, SessionHandle } from "../src/ports/agent-runtime.js";
import type { ReviewInput } from "../src/ports/reviewer.js";

const changeSet = {
  id: "changeset-1",
  taskId: "task-1",
  sessionId: "session-1",
  directory: "/tmp/ade-review",
  capturedAt: "2026-09-09T10:00:00.000Z",
  runtimeDiff: [],
  git: { status: " M README.md", patch: "diff", untracked: [] },
};
const input: ReviewInput = { taskId: "task-1", intent: "Change the readme", acceptanceCriteria: ["The readme names the command"], changeSet };

function runtimeAnswering(answer: unknown, sessionId = "claude-pending-1"): AgentRuntimePort & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    health: async () => ({ healthy: true }),
    createSession: async ({ directory }): Promise<SessionHandle> => ({ id: sessionId, directory }),
    prompt: async () => ({}),
    promptAndWait: async (_session, promptInput) => { prompts.push(promptInput.text); return answer; },
    async *events() { return; },
    diff: async () => [],
    abort: async () => undefined,
  };
}

test("a CLI provider can review, answering in prose-wrapped JSON", async () => {
  const runtime = runtimeAnswering({ output: "Here is my review:\n```json\n{\"summary\":\"One problem\",\"findings\":[{\"severity\":\"high\",\"claim\":\"The readme was not touched\",\"evidence\":\"No README.md in the diff\",\"action\":\"fix\",\"path\":\"README.md\"}]}\n```", provider: "claude" });

  const review = await new CliReviewer(runtime, "claude-reviewer").review(input);

  assert.equal(review.reviewer, "claude-reviewer");
  assert.equal(review.summary, "One problem");
  assert.equal(review.findings[0]?.claim, "The readme was not touched");
  assert.equal(review.findings[0]?.location?.path, "README.md");
  // A CLI names its session only when the turn ends, so a placeholder id is not
  // recorded as if the review could be resumed from it.
  assert.equal(review.sessionId, undefined);
  // The reviewer judges against the stated bar and never writes.
  assert.match(runtime.prompts[0] ?? "", /1\. The readme names the command/);
  assert.match(runtime.prompts[0] ?? "", /a criterion left unmet is a finding/);
});

test("a Codex JSONL transcript is read as the same review", async () => {
  const jsonl = [
    '{"type":"thread.started","thread_id":"t1"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"summary\\":\\"Looks fine\\",\\"findings\\":[]}"}}',
    '{"type":"turn.completed","usage":{"input_tokens":10}}',
  ].join("\n");

  const review = await new CliReviewer(runtimeAnswering(jsonl, "codex-pending-1"), "codex-reviewer").review(input);

  assert.equal(review.summary, "Looks fine");
  assert.deepEqual(review.findings, []);
});

test("OpenCode's structured answer still reads through the same contract", async () => {
  const review = await new OpenCodeReviewer(runtimeAnswering({ info: { structured: { summary: "No findings", findings: [] } } }, "opencode-1")).review(input);

  assert.equal(review.reviewer, "opencode-reviewer");
  assert.equal(review.sessionId, "opencode-1");
  assert.equal(review.summary, "No findings");
});

test("an answer that is not a review is refused rather than invented", () => {
  assert.throws(() => parseReviewPayload({ output: "I could not review this." }), /no structured output/);
  assert.throws(() => parseReviewPayload({ summary: "Bad", findings: [{ severity: "urgent", claim: "x", evidence: "y", action: "fix" }] }), /invalid severity or action/);
  assert.throws(() => parseReviewPayload({ summary: "Bad", findings: [{ severity: "high", claim: "x", action: "fix" }] }), /requires claim and evidence/);
});

test("a Task with no acceptance criteria tells the reviewer so instead of implying a bar", () => {
  const prompt = buildReviewPrompt({ taskId: "task-1", intent: "Change the readme", changeSet });
  assert.match(prompt, /No acceptance criteria were recorded; judge only against the stated intent\./);
  assert.match(prompt, /do not invent findings to fill it/);
});

test("the review runs on the provider doing the work, not on a wired-in one", () => {
  const store = new AdeStore();
  createTask(store, { id: "task-provider", intent: "Change the readme", repositoryPath: "/tmp/ade-review", acceptanceCriteria: ["The readme changes"] });

  // Nothing known yet: OpenCode remains the fallback, not the rule.
  assert.equal(reviewProvider(store, "task-provider"), "opencode");

  store.saveAgentSession({ id: "claude-1", taskId: "task-provider", provider: "claude", directory: "/tmp/ade-review", status: "COMPLETED", createdAt: "2026-09-09T10:00:00.000Z" });
  assert.equal(reviewProvider(store, "task-provider"), "claude");
  // An explicit request still wins over the Task's history.
  assert.equal(reviewProvider(store, "task-provider", "codex"), "codex");
  assert.equal(reviewProvider(store, "task-provider", "nonsense"), "claude");

  assert.equal(isAgentProvider("claude"), true);
  assert.equal(isAgentProvider("gpt"), false);
  assert.equal(createReviewer("codex") instanceof CliReviewer, true);
  assert.equal(createReviewer("claude") instanceof CliReviewer, true);
  assert.equal(createReviewer("opencode") instanceof OpenCodeReviewer, true);
});
