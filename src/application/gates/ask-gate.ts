import type { Gate } from "../../domain/gate.js";
import type { SkillPermission } from "../../domain/skill.js";
import { executeAsk, type AskExecution } from "../../adapters/ask-command.js";
import { listSkills } from "../skills/skill-catalog.js";
import { assertSkillPermissions } from "../skills/skill-permissions.js";

export const askGateSkillId = "ask-gate";
export const structuralGateId = "structural-gate";

export type AskGateVerdict = "PASS" | "BLOCK" | "UNVERIFIED";

export type AskGateResult = {
  gate: Gate;
  verdict: AskGateVerdict;
  exitCode: number;
  since: string | null;
  pr: number | null;
  blockingComponents: readonly string[];
  unverifiedComponents: readonly string[];
  tool: { name: string; version: string | null; buildCommit: string | null };
  command: readonly string[];
  ranAt: string;
};

type AskGateEnvelope = {
  schema_version?: unknown;
  verdict?: unknown;
  exit_code?: unknown;
  since?: unknown;
  pr?: unknown;
  blocking_components?: unknown;
  unverified_components?: unknown;
  manifest?: { build?: { tool?: unknown; tool_version?: unknown; build_commit?: unknown } };
};

export type AskGateInput = {
  repositoryPath: string;
  since?: string;
  pr?: number;
  profile?: string;
  grantedPermissions?: readonly SkillPermission[];
};

export type AskGateDependencies = { run?: (args: readonly string[], options?: { cwd?: string }) => Promise<AskExecution> };

/** The Project skill is the unit of authorization: ASK runs a local command, so
    a Project that has not installed and granted `ask-gate` never spawns it. */
export async function evaluateAskGate(input: AskGateInput, dependencies: AskGateDependencies = {}): Promise<AskGateResult> {
  const skill = (await listSkills(input.repositoryPath)).find((candidate) => candidate.id === askGateSkillId);
  if (!skill) throw new Error(`Project skill ${askGateSkillId} is not installed in this Project: install it with skills.install before running the structural gate`);
  assertSkillPermissions(skill, input.grantedPermissions ?? []);

  const command = buildCommand(input);
  const run = dependencies.run ?? executeAsk;
  const execution = await run(command, { cwd: input.repositoryPath });
  const envelope = parseEnvelope(execution);
  const verdict = readVerdict(envelope.verdict);
  const blockingComponents = stringArray(envelope.blocking_components);
  const unverifiedComponents = stringArray(envelope.unverified_components);
  const build = envelope.manifest?.build ?? {};
  return {
    gate: toGate(verdict, blockingComponents, unverifiedComponents),
    verdict,
    exitCode: typeof envelope.exit_code === "number" ? envelope.exit_code : execution.exitCode,
    since: typeof envelope.since === "string" ? envelope.since : null,
    pr: typeof envelope.pr === "number" ? envelope.pr : null,
    blockingComponents,
    unverifiedComponents,
    tool: {
      name: typeof build.tool === "string" ? build.tool : "ask",
      version: typeof build.tool_version === "string" ? build.tool_version : null,
      buildCommit: typeof build.build_commit === "string" ? build.build_commit : null,
    },
    command,
    ranAt: new Date().toISOString(),
  };
}

function buildCommand(input: AskGateInput): readonly string[] {
  return [
    "pack", "gate", input.repositoryPath,
    "--format", "json",
    "--compact",
    ...(input.since ? ["--since", input.since] : []),
    ...(input.pr !== undefined ? ["--pr", String(input.pr)] : []),
    ...(input.profile ? ["--profile", input.profile] : []),
  ];
}

/** A verdict ASK could not print is not a passing gate: an unreadable answer is
    reported as the failure it is, with what the tool said on stderr. */
function parseEnvelope(execution: AskExecution): AskGateEnvelope {
  let envelope: AskGateEnvelope;
  try {
    envelope = JSON.parse(execution.stdout) as AskGateEnvelope;
  } catch {
    const detail = (execution.stderr.trim() || execution.stdout.trim()).slice(0, 500);
    throw new Error(`ASK did not return a gate pack (exit ${execution.exitCode})${detail ? `: ${detail}` : ""}`);
  }
  const refusal = (envelope as { error?: { message?: unknown; hint?: unknown } }).error;
  if (refusal && typeof refusal.message === "string") {
    throw new Error(`ASK refused the request: ${refusal.message}${typeof refusal.hint === "string" ? ` ${refusal.hint}` : ""}`);
  }
  const schema = envelope.schema_version;
  if (typeof schema !== "string" || !schema.startsWith("ask-pack-gate")) {
    throw new Error(`ASK returned ${typeof schema === "string" ? schema : "an unknown payload"} where a gate pack was expected`);
  }
  return envelope;
}

function readVerdict(value: unknown): AskGateVerdict {
  if (value === "PASS" || value === "BLOCK" || value === "UNVERIFIED") return value;
  throw new Error(`ASK returned an unknown gate verdict: ${String(value)}`);
}

/** UNVERIFIED is not a failure and never a pass: ASK proved nothing either way,
    which is exactly what a pending gate says. */
function toGate(verdict: AskGateVerdict, blocking: readonly string[], unverified: readonly string[]): Gate {
  if (verdict === "PASS") return { id: structuralGateId, required: true, status: "passed", evidenceIds: [] };
  const components = (verdict === "BLOCK" ? blocking : unverified).join(", ");
  return {
    id: structuralGateId,
    required: true,
    status: verdict === "BLOCK" ? "failed" : "pending",
    evidenceIds: [],
    failureReason: verdict === "BLOCK"
      ? `ASK blocked the change${components ? `: ${components}` : ""}`
      : `ASK could not decide${components ? `: ${components}` : ""}`,
  };
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function askGateEvidenceType(verdict: AskGateVerdict): string {
  return `structural.gate.${verdict.toLowerCase()}`;
}

export function askGateSummary(result: AskGateResult): string {
  const scope = result.pr !== null ? `PR #${result.pr}` : result.since ? `since ${result.since}` : "working tree";
  const components = result.verdict === "BLOCK" ? result.blockingComponents : result.unverifiedComponents;
  return `ASK ${result.verdict} (${scope})${components.length ? ` — ${components.join(", ")}` : ""}`;
}
