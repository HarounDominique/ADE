import type { ReviewInput, ReviewOutput } from "../ports/reviewer.js";

/**
 * Minimal non-LLM reviewer for the spike. It proves the governance contract
 * without claiming semantic code-review capability.
 */
export class EvidenceReviewer {
  async review(input: ReviewInput): Promise<ReviewOutput> {
    const hasChanges = input.changeSet.git.status.trim().length > 0
      || input.changeSet.git.patch.trim().length > 0
      || input.changeSet.runtimeDiff.length > 0;
    if (hasChanges) {
      return {
        reviewer: "evidence-reviewer",
        summary: `Evidence confirms a repository change for task: ${input.intent}`,
        findings: [],
      };
    }
    return {
      reviewer: "evidence-reviewer",
      summary: "No repository change was detected in the ChangeSet.",
      findings: [{
        id: `finding-${input.changeSet.id}`,
        severity: "medium",
        claim: "The ChangeSet contains no detectable file change.",
        evidence: "OpenCode diff and Git status are both empty.",
        action: "fix",
      }],
    };
  }
}
