import type { AgentRuntimePort } from "../ports/agent-runtime.js";
import type { ReviewerPort } from "../ports/reviewer.js";
import { AdeStore } from "../persistence/sqlite-store.js";
import { reviewChangeSet } from "./review-change-set.js";
import { runSpike, type SpikeResult } from "./run-spike.js";

export type ReviewFlowResult = {
  implementation: SpikeResult;
  review: Awaited<ReturnType<typeof reviewChangeSet>>;
};

export async function runReviewFlow(
  runtime: AgentRuntimePort,
  reviewer: ReviewerPort,
  input: {
    taskId: string;
    directory: string;
    intent: string;
    agent?: string;
    signal?: AbortSignal;
    store: AdeStore;
  },
): Promise<ReviewFlowResult> {
  const implementation = await runSpike(runtime, input);
  const review = await reviewChangeSet(reviewer, {
    task: implementation.task,
    changeSet: implementation.changeSet,
    store: input.store,
  });
  return { implementation, review };
}
