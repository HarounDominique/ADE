import test from "node:test";
import assert from "node:assert/strict";
import { OpenCodeReviewer } from "../src/adapters/opencode-reviewer.js";
import { createChangeSet } from "../src/domain/change-set.js";
import type { AgentRuntimePort } from "../src/ports/agent-runtime.js";

test("OpenCode reviewer uses a new session and maps structured findings", async () => {
  let reviewedText = "";
  const runtime: AgentRuntimePort = {
    health: async () => ({ healthy: true }),
    createSession: async (input) => ({ id: `review-session-${input.title}`, directory: "/tmp" }),
    prompt: async () => {},
    promptAndWait: async (_session, input) => {
      reviewedText = input.text;
      return { data: { info: { structured_output: {
        summary: "One important issue found",
        findings: [{ severity: "high", path: "src/a.ts", line: 12, claim: "Unsafe path", evidence: "Input is not validated", action: "fix" }],
      } } } };
    },
    events: async function* () {},
    diff: async () => [],
    abort: async () => {},
  };
  const changeSet = createChangeSet({
    id: "changeset-real-review",
    taskId: "task-1",
    sessionId: "implementer-session",
    directory: "/tmp/review-project",
    runtimeDiff: [{ path: "src/a.ts" }],
    git: { status: " M src/a.ts\n", patch: "diff", untracked: [] },
  });

  const review = await new OpenCodeReviewer(runtime).review({
    taskId: "task-1",
    intent: "Improve validation",
    changeSet,
  });

  assert.equal(review.sessionId, "review-session-review-changeset-real-review");
  assert.equal(review.findings[0]?.severity, "high");
  assert.equal(review.findings[0]?.location?.path, "src/a.ts");
  assert.match(reviewedText, /Do not discuss the implementer's conversation/);
  assert.match(reviewedText, /Improve validation/);
});
