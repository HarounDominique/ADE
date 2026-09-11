import type { GatePolicy } from "../change-review/gate-policy.js";
import type { UserSettings } from "../settings/settings.js";

/** Whether ADE conducts this Project's work through the adaptive workflow.

    Two levels, each with a precedent already in the code: the operator's own
    preference lives in `UserSettings` the way `turnChime` does, and the
    Project's position lives in `.ade/policy.json` the way `requiredGates` does.

    The Project wins when it speaks, because a repository that requires the
    workflow requires it of whoever opens it. Silence is not refusal: a policy
    that never mentions the workflow hands the decision back to the operator,
    and when neither says anything the workflow is on (ADR-0056). */
export function isDevelopmentWorkflowEnabled(input: { user: UserSettings; policy: GatePolicy }): boolean {
  if (typeof input.policy.developmentWorkflow === "boolean") return input.policy.developmentWorkflow;
  return input.user.developmentWorkflow;
}
