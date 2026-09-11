import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GatePolicy = {
  requiredGates: readonly string[];
  evidence: { maxItems: number; summaryLimit: number; detailsLimit: number };
  gitWorkflow: "pull-request" | "direct";
  /** Whether an agent turn on a Java repository is told that ASK is installed. */
  structuralBriefing: boolean;
  /** The Project's position on the adaptive workflow, when it has one.
      `undefined` is silence, which leaves the decision to the operator's own
      setting -- a repository that never mentioned the workflow must not read as
      one that refused it (ADR-0056). */
  developmentWorkflow?: boolean;
  /** How this Project names production and test files, when its convention is
      not one the stock patterns already cover (`*_spec.rb`, `Test*.java`).
      Declared once here, never loosened per commit. */
  tdd: { productionExtensions?: readonly string[]; testNamePatterns?: readonly string[] };
};

const DEFAULT_POLICY: GatePolicy = {
  requiredGates: ["build", "tests", "agent-review", "documentation-review", "human-approval"],
  evidence: { maxItems: 100, summaryLimit: 500, detailsLimit: 2_000 },
  gitWorkflow: "pull-request",
  structuralBriefing: true,
  tdd: {},
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
      structuralBriefing: raw.structuralBriefing !== false,
      ...(typeof raw.developmentWorkflow === "boolean" ? { developmentWorkflow: raw.developmentWorkflow } : {}),
      tdd: readTddConventions(raw.tdd),
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

function stringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim()) ? value as string[] : fallback;
}
/** An empty or malformed list is silence, so the guard keeps its stock
    patterns. A Project cannot accidentally widen what passes by writing a
    convention ADE could not read. */
function readTddConventions(value: unknown): GatePolicy["tdd"] {
  const raw = (value ?? {}) as Record<string, unknown>;
  const production = stringArray(raw.productionExtensions, []);
  const patterns = stringArray(raw.testNamePatterns, []);
  return {
    ...(production.length ? { productionExtensions: production } : {}),
    ...(patterns.length ? { testNamePatterns: patterns } : {}),
  };
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
