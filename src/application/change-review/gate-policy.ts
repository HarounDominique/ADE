import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GatePolicy = {
  requiredGates: readonly string[];
  evidence: { maxItems: number; summaryLimit: number; detailsLimit: number };
  gitWorkflow: "pull-request" | "direct";
};

const DEFAULT_POLICY: GatePolicy = {
  requiredGates: ["build", "tests", "agent-review", "documentation-review", "human-approval"],
  evidence: { maxItems: 100, summaryLimit: 500, detailsLimit: 2_000 },
  gitWorkflow: "pull-request",
};

export function loadGatePolicy(repositoryPath?: string): GatePolicy {
  if (!repositoryPath) return DEFAULT_POLICY;
  try {
    const raw = JSON.parse(readFileSync(join(repositoryPath, ".ade", "policy.json"), "utf8")) as Record<string, unknown>;
    const evidence = (raw.evidence ?? {}) as Record<string, unknown>;
    return {
      requiredGates: stringArray(raw.requiredGates, DEFAULT_POLICY.requiredGates),
      evidence: {
        maxItems: positiveInt(evidence.maxItems, DEFAULT_POLICY.evidence.maxItems),
        summaryLimit: positiveInt(evidence.summaryLimit, DEFAULT_POLICY.evidence.summaryLimit),
        detailsLimit: positiveInt(evidence.detailsLimit, DEFAULT_POLICY.evidence.detailsLimit),
      },
      gitWorkflow: raw.gitWorkflow === "direct" ? "direct" : "pull-request",
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

function stringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim()) ? value as string[] : fallback;
}
function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
