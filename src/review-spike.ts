import { OpenCodeHttpRuntime } from "./adapters/opencode-http-runtime.js";
import { OpenCodeReviewer } from "./adapters/opencode-reviewer.js";
import { AdeStore } from "./persistence/sqlite-store.js";
import { runReviewFlow } from "./application/run-review-flow.js";

const directory = process.argv[2] ?? process.cwd();
const intent = process.argv.slice(3).join(" ") || "Inspect the repository and report its current state without editing files.";
const runtime = new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
const reviewer = new OpenCodeReviewer(runtime);
const store = new AdeStore(process.env.ADE_DB_PATH ?? `${directory}/.ade/ade.db`);

try {
  const result = await runReviewFlow(runtime, reviewer, {
    taskId: `task-${Date.now()}`,
    directory,
    intent,
    store,
  });
  console.log(JSON.stringify({
    taskId: result.implementation.taskId,
    sessionId: result.implementation.sessionId,
    reviewerSessionId: result.review.sessionId,
    taskStatus: result.implementation.task.currentStatus,
    review: result.review,
  }, null, 2));
} finally {
  store.close();
}
