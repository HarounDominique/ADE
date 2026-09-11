import { AdeStore } from "../../persistence/sqlite-store.js";
import { assertDispatchable, proposeNextPhase } from "./advance.js";
import { getTaskWorkflow } from "./task-workflow.js";
import { rulesForPhase } from "./learned-rules.js";

/** What the `adaptive-workflow` skill actually sends a provider.

    Before this, running the skill meant forwarding its own one-line catalogue
    description as a prompt -- the agent was told the skill's name and asked to
    get on with it. The briefing is the difference between a manifest and a
    body: it carries where the work is, what done means, which attempt this is,
    what the Project has already learned about the files being touched, and the
    shape the answer has to come back in (ADR-0056). */
export function buildWorkflowBriefing(
  store: AdeStore,
  input: { taskId: string; projectId: string; touchedFiles: readonly string[]; maxRules?: number },
): string {
  const task = store.rehydrateTask(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);

  const state = getTaskWorkflow(store, input.taskId);
  if (!state) throw new Error(`Task has no workflow to brief: ${input.taskId}`);

  /** A phase that has exhausted its attempts is not briefed. Dispatching it a
      third time is exactly what the halt exists to prevent, and doing it from
      here would route around the rule rather than enforce it. */
  const dispatch = assertDispatchable(state, state.currentPhase);

  const last = state.history().at(-1);
  const next = proposeNextPhase(state);
  const rules = rulesForPhase(store, {
    projectId: input.projectId,
    touchedFiles: input.touchedFiles,
    ...(input.maxRules === undefined ? {} : { maxRules: input.maxRules }),
  });

  const lines = [
    `You are running one phase of ADE's adaptive development workflow.`,
    ``,
    `## The Task`,
    `Intent: ${task.intent}`,
    `Done means:`,
    ...task.acceptance().map((criterion) => `- ${criterion}`),
    ``,
    `## Where the work is`,
    `Phase: ${state.currentPhase}`,
    `Mode: ${state.currentMode} (cycle ${state.currentCycle})`,
    `This is attempt ${dispatch.attempt} at this phase.`,
    ...(dispatch.escalate
      ? [`This phase already failed once, so this attempt runs at a higher tier. Re-read the requirement before changing the same thing again.`]
      : []),
    ...(last?.reentry ? [`The work came back here for a reason: ${last.reason}`] : []),
    ...(next ? [`If this phase succeeds, the route proposes ${next} next.`] : [`The route has no further proposal; say what you think comes next and why.`]),
    ``,
  ];

  if (rules.length) {
    lines.push(
      `## What this Project has already learned`,
      `These apply to the files this phase touches. Higher priority wins a conflict.`,
      ...rules.map((rule) => `- [${rule.priority}] ${rule.directive}`),
      ``,
    );
  }

  lines.push(
    `## What to return`,
    `A WorkflowResult: the phase you ran, the phase you propose next (omit it to stay),`,
    `the ids of any evidence you produced, what you observed about the gates, and the`,
    `reason for all of it. The reason is not optional.`,
    ``,
    `## What you may not decide`,
    `- You cannot pass the human-approval gate. Approval is the operator's.`,
    `- You cannot waive a gate. Reporting one passed or failed is evidence; waiving one`,
    `  is a decision to accept the risk it was protecting against, and that is a person's.`,
    `- You cannot skip a phase the matrix forbids. Propose re-entry instead, and say why.`,
  );

  return lines.join("\n");
}
