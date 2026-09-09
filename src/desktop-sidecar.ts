import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";
import { advanceTask, createTask } from "./application/tasks/task-commands.js";
import type { TaskStatus } from "./domain/task.js";
import { AdeStore } from "./persistence/sqlite-store.js";
import { getProjectSnapshot } from "./application/project-snapshot.js";
import { OpenCodeHttpRuntime } from "./adapters/opencode-http-runtime.js";
import { CodexCliRuntime, extractCodexPressure, extractCodexUsage } from "./adapters/codex-cli-runtime.js";
import { ClaudeCliRuntime, extractClaudePressure, extractClaudeText, extractClaudeUsage } from "./adapters/claude-cli-runtime.js";
import { runSpike } from "./application/run-spike.js";
import { createRuntimeEvidence } from "./domain/runtime-evidence.js";
import { getRuntimeHistory, getTaskDetail } from "./application/task-detail.js";
import { getChangeReview } from "./application/change-review-read-model.js";
import { approveTaskFromStore } from "./application/tasks/approval-from-store.js";
import { ShipBlockedError, shipTaskFromStore } from "./application/tasks/ship-from-store.js";
import { OpenCodeReviewer } from "./adapters/opencode-reviewer.js";
import { reviewChangeSet } from "./application/review-change-set.js";
import { LocalProcess } from "./adapters/local-process.js";
import { ServiceManager, type ServiceDefinition } from "./application/local-runtime/service-manager.js";
import type { ChangeSet } from "./domain/change-set.js";
import { inspectProviders } from "./application/agent-providers/provider-registry.js";
import { listNativeSkills, listSkills } from "./application/skills/skill-catalog.js";
import { getGitStatus } from "./application/git/git-status.js";
import { findReferenceImpact } from "./application/knowledge/reference-impact.js";
import { runNativeSkill } from "./application/skills/run-skill.js";
import { askGateEvidenceType, askGateSummary, evaluateAskGate } from "./application/gates/ask-gate.js";
import { captureTurnChangeSet } from "./application/agents/capture-turn-change-set.js";
import { askBriefing, composeAgentPrompt } from "./application/structural-context/ask-briefing.js";
import { inspectGitWorkspace } from "./application/git/workspace-status.js";
import { inspectGitHub } from "./application/git/github-status.js";
import { commitAndPush, createBranch, createCommit, createPullRequest, createWorktree, fetchOrigin, pushBranch, switchBranch } from "./application/git/git-mutations.js";
import { inspectPendingGitChanges, listGitCommits, readGitCommitDiff, readPendingGitDiff } from "./application/git/version-control.js";
import { buildKnowledgeGraph } from "./application/knowledge/knowledge-graph.js";
import { loadServiceDefinitions } from "./application/local-runtime/service-config.js";
import { loadRunConfigurations, saveRunConfigurations } from "./application/local-runtime/run-config.js";
import { detectRunConfigurations } from "./application/local-runtime/run-detection.js";
import { inspectProjectToolchains } from "./application/local-runtime/toolchain-inspection.js";
import { RunManager, RunPortConflictError } from "./application/local-runtime/run-manager.js";
import { appendVerificationOutput, isTerminalRunState, recordVerificationRun, type VerificationRun } from "./application/local-runtime/verification-evidence.js";
import { LocalPortProbe } from "./adapters/local-port-probe.js";
import type { ResolvedRunConfiguration, RunConfiguration } from "./domain/run-configuration.js";
import { applyKnowledgeReconciliation, proposeKnowledgeReconciliation, reconcileChangedDocumentation } from "./application/knowledge/reconcile.js";
import { loadGatePolicy } from "./application/change-review/gate-policy.js";
import { installProjectSkill, projectSkillSourceNeedsNetwork, skillSourceNeedsNetwork, updateProjectSkill } from "./application/skills/skill-install.js";
import { registerProject } from "./application/tasks/project-commands.js";
import { LocalGitRepository } from "./adapters/local-git-repository.js";
import { GitUnavailableError } from "./adapters/git-command.js";
import { fallbackTerminalTitle, type TerminalAgentProvider } from "./application/terminal-history/agent-terminal.js";
import { resolveProviderSessionId } from "./application/terminal-history/provider-session-id.js";

export type DesktopRequest = {
  id: string | number;
  method: string;
  params?: { projectId?: string; taskId?: string; intent?: string; body?: string; name?: string; skillId?: string; provider?: string; model?: string; sessionId?: string; requestId?: string; prompt?: string; commit?: string; file?: string; grantedPermissions?: Array<"read_project" | "write_code" | "write_docs" | "run_commands" | "network">; repositoryPath?: string; next?: TaskStatus; reason?: string; actor?: string; confirmed?: boolean; serviceId?: string; command?: string; args?: string[]; cwd?: string; branch?: string; worktreePath?: string; configurationId?: string; configurations?: RunConfiguration[]; mode?: "run" | "debug"; runSessionId?: string; transcript?: string; since?: string; profile?: string; title?: string; startedAt?: string; agentStartedAt?: string; endedAt?: string; truncated?: boolean };
};

export type DesktopResponse = {
  id: string | number;
  result?: unknown;
  error?: { code: string; message: string };
};

export type RuntimeStatus = {
  sidecar: "READY";
  agentRuntime: "DISCONNECTED" | "RUNNING" | "CONNECTED" | "FAILED";
  activeTaskId: string | null;
  lastEventAt: string | null;
  lastError: string | null;
};

const runtimeStatus: RuntimeStatus = {
  sidecar: "READY",
  agentRuntime: "DISCONNECTED",
  activeTaskId: null,
  lastEventAt: null,
  lastError: null,
};
let runtimeEvidenceSequence = 0;
let serviceManager: ServiceManager | undefined;
let declaredServices: readonly ServiceDefinition[] = [];
/** One supervisor per Project: a run belongs to the repository it was started
    from, and switching Project must not inherit another one's processes. */
const runManagers = new Map<string, RunManager>();
/** Runs the operator started as verification of a Task, kept until the process
    ends: only then is there an exit code for a gate to cite. Declared before
    the run starts and keyed by configuration, then keyed by session as soon as
    the supervisor names one, because a fast command can finish before `start`
    returns. */
const pendingVerifications = new Map<string, VerificationRun>();
const verificationRuns = new Map<string, VerificationRun>();
type ActiveAgentPrompt = {
  projectId?: string;
  runtime?: import("./ports/agent-runtime.js").AgentRuntimePort;
  session?: import("./ports/agent-runtime.js").SessionHandle;
  eventAbortController?: AbortController;
  aborted: boolean;
};
const activeAgentPrompts = new Map<string, ActiveAgentPrompt>();

function gitError(error: unknown, fallback = "GIT_FAILED"): { code: string; message: string } {
  const unavailable = error instanceof GitUnavailableError
    || (error && typeof error === "object" && "code" in error && error.code === "ENOENT");
  return {
    code: unavailable ? "GIT_UNAVAILABLE" : fallback,
    message: error instanceof Error ? error.message : String(error),
  };
}

function getRuntimeStatus(): RuntimeStatus {
  return {
    ...runtimeStatus,
  };
}

/** Sessions recorded before Assay knew to look, and sessions whose lookup found
    nothing at the time, are still identifiable from the window they ran in. The
    popup is the natural moment to try again: it costs one directory listing and
    turns a two-step resume -- click the row, then find it again in the agent's
    own picker -- into a single click. A session that stays unresolved keeps
    saying so on its row. */
function backfillTerminalConversationIds(store: AdeStore, projectId: string, repositoryPath: string | undefined) {
  const sessions = store.listTerminalHistorySessions(projectId);
  if (!repositoryPath) return sessions;
  const takenIds = sessions.map((session) => session.providerSessionId).filter((id): id is string => Boolean(id));
  return sessions.map((session) => {
    if (session.providerSessionId) return session;
    try {
      const providerSessionId = resolveProviderSessionId(session.provider, { repositoryPath, startedAt: session.startedAt, endedAt: session.endedAt, takenIds });
      if (!providerSessionId) return session;
      takenIds.push(providerSessionId);
      store.saveTerminalHistorySession({ ...session, providerSessionId });
      return { ...session, providerSessionId };
    } catch {
      return session;
    }
  });
}

export function handleDesktopRequest(store: AdeStore, request: DesktopRequest): DesktopResponse {
  try {
    if (!['project.list', 'project.remove', 'project.snapshot', 'task.create', 'task.advance', 'runtime.status', 'task.detail', 'runtime.history', 'change.review', 'task.approve', 'task.git.operations', 'runtime.sessions', 'agent.session.delete', 'terminal.history.list', 'terminal.history.get', 'terminal.history.save', 'terminal.history.delete', 'service.status', 'skills.list'].includes(request.method)) {
      return { id: request.id, error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${request.method}` } };
    }
    if (request.method === "project.list") {
      return { id: request.id, result: store.listProjects() };
    }
    if (request.method === "project.remove") {
      const projectId = request.params?.projectId;
      if (!projectId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "projectId is required" } };
      if (!store.getProject(projectId)) return { id: request.id, error: { code: "PROJECT_NOT_FOUND", message: `Project not found: ${projectId}` } };
      store.removeProject(projectId);
      return { id: request.id, result: { id: projectId, removed: true } };
    }
    if (request.method === "project.snapshot") {
      const projectId = request.params?.projectId;
      if (!projectId) {
        return { id: request.id, error: { code: "INVALID_PARAMS", message: "projectId is required" } };
      }
      return { id: request.id, result: getProjectSnapshot(store, projectId) };
    }
    if (request.method === "runtime.status") {
      return { id: request.id, result: getRuntimeStatus() };
    }
    if (request.method === "task.git.operations") {
      const taskId = request.params?.taskId;
      if (!taskId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId is required" } };
      if (!store.rehydrateTask(taskId)) return { id: request.id, error: { code: "TASK_NOT_FOUND", message: `Task not found: ${taskId}` } };
      return { id: request.id, result: store.listGitOperations(taskId) };
    }
    if (request.method === "runtime.sessions") return { id: request.id, result: store.listAgentSessions(request.params?.taskId) };
    if (request.method === "agent.session.delete") {
      const sessionId = request.params?.sessionId;
      if (!sessionId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "sessionId is required" } };
      const session = store.getAgentSession(sessionId);
      if (!session) return { id: request.id, error: { code: "SESSION_NOT_FOUND", message: `Agent session ${sessionId} was not found` } };
      if (request.params?.projectId && session.projectId && session.projectId !== request.params.projectId) return { id: request.id, error: { code: "SESSION_PROJECT_MISMATCH", message: "This conversation belongs to another Project" } };
      store.deleteAgentSession(sessionId);
      return { id: request.id, result: { id: sessionId, removed: true } };
    }
    if (request.method === "terminal.history.list") {
      if (!request.params?.projectId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "projectId is required" } };
      const sessions = backfillTerminalConversationIds(store, request.params.projectId, request.params.repositoryPath);
      return { id: request.id, result: sessions.map(({ transcript, ...session }) => session) };
    }
    if (request.method === "terminal.history.get" || request.method === "terminal.history.delete") {
      const sessionId = request.params?.sessionId;
      if (!sessionId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "sessionId is required" } };
      const session = store.getTerminalHistorySession(sessionId);
      if (!session) return { id: request.id, error: { code: "TERMINAL_SESSION_NOT_FOUND", message: `Terminal session ${sessionId} was not found` } };
      if (request.params?.projectId && session.projectId !== request.params.projectId) return { id: request.id, error: { code: "TERMINAL_SESSION_PROJECT_MISMATCH", message: "This terminal session belongs to another Project" } };
      if (request.method === "terminal.history.delete") { store.deleteTerminalHistorySession(sessionId); return { id: request.id, result: { id: sessionId, removed: true } }; }
      return { id: request.id, result: session };
    }
    if (request.method === "terminal.history.save") {
      const params = request.params;
      if (!params?.sessionId || !params.projectId || !params.provider || !params.transcript || !params.startedAt || !params.endedAt) return { id: request.id, error: { code: "INVALID_PARAMS", message: "sessionId, projectId, provider, transcript, startedAt and endedAt are required" } };
      if (!['claude', 'codex', 'opencode'].includes(params.provider)) return { id: request.id, error: { code: "INVALID_PARAMS", message: "provider must be a recognized terminal agent" } };
      const provider = params.provider as TerminalAgentProvider;
      /** The agent's own session store is what makes the conversation resumable
          later. Losing that lookup must never cost the operator the history, so
          a failure degrades to the provider's picker instead of an error. */
      let providerSessionId: string | undefined;
      if (params.repositoryPath) {
        try {
          const takenIds = store.listTerminalHistorySessions(params.projectId).filter((session) => session.id !== params.sessionId).map((session) => session.providerSessionId).filter((id): id is string => Boolean(id));
          /** Resolution uses the window this tab actually ran the agent in. A
              reopened session keeps the conversation's original start, and
              measuring from there would sweep in every conversation begun
              since -- including the operator's own, live in the same folder. */
          providerSessionId = resolveProviderSessionId(provider, { repositoryPath: params.repositoryPath, startedAt: params.agentStartedAt ?? params.startedAt, endedAt: params.endedAt, takenIds });
        } catch {
          providerSessionId = undefined;
        }
      }
      store.saveTerminalHistorySession({ id: params.sessionId, projectId: params.projectId, provider, title: params.title?.slice(0, 60) || fallbackTerminalTitle(provider, params.endedAt), transcript: params.transcript, truncated: Boolean(params.truncated), startedAt: params.startedAt, endedAt: params.endedAt, providerSessionId });
      return { id: request.id, result: { id: params.sessionId, saved: true } };
    }
    if (request.method === "skills.list") return { id: request.id, result: listNativeSkills() };
    if (request.method === "service.status") {
      const serviceId = request.params?.serviceId;
      if (!serviceId || !serviceManager) return { id: request.id, error: { code: "INVALID_PARAMS", message: "serviceId is required" } };
      return { id: request.id, result: { serviceId, status: serviceManager.status(serviceId) } };
    }
    if (request.method === "task.detail" || request.method === "runtime.history" || request.method === "change.review") {
      const taskId = request.params?.taskId;
      if (!taskId) return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId is required" } };
      return { id: request.id, result: request.method === "task.detail" ? getTaskDetail(store, taskId) : request.method === "runtime.history" ? getRuntimeHistory(store, taskId) : getChangeReview(store, taskId) };
    }
    if (request.method === "task.approve") {
      const { taskId, reason, actor } = request.params ?? {};
      if (!taskId || !reason) return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId and reason are required" } };
      approveTaskFromStore(store, { id: taskId, reason, ...(actor ? { actor } : {}) });
      return { id: request.id, result: { taskId, status: "COMPLETED", actor: actor ?? "human" } };
    }
    const { taskId, intent, projectId, repositoryPath, next, reason, actor } = request.params ?? {};
    if (request.method === "task.advance") {
      if (!taskId || !next || !reason) {
        return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId, next and reason are required" } };
      }
      const task = advanceTask(store, { id: taskId, next, reason, ...(actor ? { actor } : {}) });
      return { id: request.id, result: { id: task.id, intent: task.intent, status: task.currentStatus, projectId: task.projectId ?? null } };
    }
    if (!taskId || !intent) {
      return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId and intent are required" } };
    }
    const task = createTask(store, {
      id: taskId,
      intent,
      ...(projectId ? { projectId } : {}),
      ...(repositoryPath ? { repositoryPath } : {}),
    });
    return { id: request.id, result: { id: task.id, intent: task.intent, status: task.currentStatus, projectId: task.projectId ?? null } };
  } catch (error) {
    return {
      id: request.id,
      error: { code: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function runDesktopSidecar(): Promise<void> {
  const databasePath = process.env.ADE_DB_PATH;
  if (!databasePath) throw new Error("ADE_DB_PATH must point to the ADE metadata database");
  const store = new AdeStore(databasePath);
  serviceManager = new ServiceManager(new LocalProcess());
  const servicesPath = process.env.ADE_SERVICES_PATH ?? join(dirname(databasePath), "services.json");
  try { declaredServices = await loadServiceDefinitions(servicesPath); } catch { declaredServices = []; }
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of input) {
      if (!line.trim()) continue;
      let request: DesktopRequest;
      try {
        request = JSON.parse(line) as DesktopRequest;
      } catch {
        process.stdout.write(`${JSON.stringify({ id: null, error: { code: "INVALID_JSON", message: "Request must be valid JSON" } })}\n`);
        continue;
      }
      if (request.method === "runtime.health") {
        void checkRuntimeHealth(request);
      } else if (request.method === "skills.list") {
        void listSkills(request.params?.repositoryPath).then((skills) => process.stdout.write(`${JSON.stringify({ id: request.id, result: skills })}\n`))
          .catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILLS_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "service.list") {
        const repositoryPath = request.params?.repositoryPath;
        const definitions = repositoryPath ? await loadServiceDefinitions(join(repositoryPath, ".ade", "services.json")).catch(() => []) : declaredServices;
        process.stdout.write(`${JSON.stringify({ id: request.id, result: definitions.map((service) => ({ id: service.id, command: service.command, cwd: service.cwd, healthcheck: service.healthcheck ? true : false, status: serviceManager?.status(service.id) ?? "DECLARED" })) })}\n`);
      } else if (request.method === "project.register") {
        const params = request.params;
        if (!params?.projectId || !params.name || !params.repositoryPath) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "projectId, name and repositoryPath are required" } })}\n`);
        else void registerProject(store, new LocalGitRepository(), { id: params.projectId, name: params.name, repositoryPath: params.repositoryPath })
          .then((project) => process.stdout.write(`${JSON.stringify({ id: request.id, result: store.getProject(project.id) ?? project })}\n`))
          .catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "PROJECT_REGISTER_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "project.remove") {
        process.stdout.write(`${JSON.stringify(handleDesktopRequest(store, request))}\n`);
      } else if (request.method === "task.run") {
        startTaskRun(store, request);
      } else if (request.method === "task.rereview") {
        startTaskRereview(store, request);
      } else if (request.method === "providers.inspect") {
        void inspectProviders(process.env.OPENCODE_URL ? { opencodeUrl: process.env.OPENCODE_URL } : {})
          .then((providers) => process.stdout.write(`${JSON.stringify({ id: request.id, result: providers })}\n`))
          .catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "PROVIDERS_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "agent.sessions") {
        const repositoryPath = request.params?.repositoryPath;
        const sessions = store.listAgentSessionsForProject(request.params?.projectId, repositoryPath);
        process.stdout.write(`${JSON.stringify({ id: request.id, result: sessions })}\n`);
      } else if (request.method === "task.ship") {
        const params = request.params;
        if (!params?.taskId || !params.intent || !params.actor || !params.reason) {
          process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "taskId, intent, actor and reason are required" } })}\n`);
        } else {
          void shipTaskFromStore(store, { taskId: params.taskId, message: params.intent, ...(params.body ? { body: params.body } : {}), actor: params.actor, reason: params.reason })
            .then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`))
            .catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: shipError(error) })}\n`));
        }
      } else if (request.method === "agent.pressure") {
        const provider = request.params?.provider;
        if (!provider) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "provider is required" } })}\n`);
        else process.stdout.write(`${JSON.stringify({ id: request.id, result: readAgentPressure(store, provider, request.params?.sessionId) })}\n`);
      } else if (request.method === "agent.messages") {
        const sessionId = request.params?.sessionId;
        if (!sessionId) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "sessionId is required" } })}\n`);
        else {
          const session = store.getAgentSession(sessionId);
          if (!session) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SESSION_NOT_FOUND", message: `Agent session ${sessionId} was not found` } })}\n`);
          else if (request.params?.projectId && session.projectId && session.projectId !== request.params.projectId) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SESSION_PROJECT_MISMATCH", message: "This conversation belongs to another Project" } })}\n`);
          else process.stdout.write(`${JSON.stringify({ id: request.id, result: store.listAgentMessages(sessionId) })}\n`);
        }
      } else if (request.method === "agent.prompt") {
        startAgentPrompt(store, request);
      } else if (request.method === "agent.abort") {
        void abortAgentPrompt(request);
      } else if (request.method === "gate.ask") {
        const params = request.params;
        if (!params?.repositoryPath) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void evaluateAskGate({
          repositoryPath: params.repositoryPath,
          ...(params.since ? { since: params.since } : {}),
          ...(params.profile ? { profile: params.profile } : {}),
          ...(params.grantedPermissions ? { grantedPermissions: params.grantedPermissions } : {}),
        }).then((result) => {
          /** A verdict nobody can cite is an opinion: when the run belongs to a
              Task, the gate is published as evidence the review model reads. */
          if (params.taskId) {
            const evidencePolicy = loadGatePolicy(params.repositoryPath).evidence;
            const evidenceId = `structural-gate-${params.taskId}-${Date.now()}-${++runtimeEvidenceSequence}`;
            store.saveRuntimeEvidence(createRuntimeEvidence({
              id: evidenceId,
              taskId: params.taskId,
              type: askGateEvidenceType(result.verdict),
              summary: askGateSummary(result),
              details: JSON.stringify({ verdict: result.verdict, exitCode: result.exitCode, since: result.since, pr: result.pr, blockingComponents: result.blockingComponents, unverifiedComponents: result.unverifiedComponents, tool: result.tool, command: result.command.join(" ") }),
              policy: evidencePolicy,
            }));
            store.pruneRuntimeEvidence(params.taskId, evidencePolicy.maxItems);
            process.stdout.write(`${JSON.stringify({ id: request.id, result: { ...result, evidenceId, gate: { ...result.gate, evidenceIds: [evidenceId] } } })}\n`);
            return;
          }
          process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        }).catch((error: unknown) => {
          const code = error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string" ? (error as { code: string }).code : "ASK_GATE_FAILED";
          process.stdout.write(`${JSON.stringify({ id: request.id, error: { code, message: error instanceof Error ? error.message : String(error) } })}\n`);
        });
      } else if (request.method === "skills.run") {
        const params = request.params;
        if (!params?.skillId || !params.intent || !params.repositoryPath) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "skillId, intent and repositoryPath are required" } })}\n`);
        else {
          const runtime = params.provider === "codex" ? new CodexCliRuntime() : params.provider === "claude" ? new ClaudeCliRuntime() : new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
          let sessionId: string | undefined;
          let createdAt: string | undefined;
          const persist = (id: string, status: string) => store.saveAgentSession({ id, ...(params.taskId ? { taskId: params.taskId } : {}), provider: params.provider ?? "opencode", directory: params.repositoryPath!, status, createdAt: createdAt ?? new Date().toISOString() });
          const persistEvent = (event: import("./ports/agent-runtime.js").RuntimeEvent) => {
            if (!params.taskId) return;
            const payload = event.payload as { type?: string; properties?: Record<string, unknown>; sessionID?: string };
            const evidencePolicy = loadGatePolicy(params.repositoryPath).evidence;
            store.saveRuntimeEvidence(createRuntimeEvidence({
              id: `skill-${params.taskId}-${Date.now()}-${++runtimeEvidenceSequence}`,
              taskId: params.taskId,
              ...(sessionId || payload.sessionID ? { sessionId: sessionId ?? payload.sessionID } : {}),
              type: `skill.${payload.type ?? event.type}`,
              summary: `${params.skillId}: ${payload.type ?? event.type}`,
              ...(payload.properties ? { details: JSON.stringify(payload.properties) } : {}),
              policy: evidencePolicy,
            }));
            store.pruneRuntimeEvidence(params.taskId, evidencePolicy.maxItems);
          };
          void runNativeSkill(runtime, {
            skillId: params.skillId,
            directory: params.repositoryPath,
            intent: params.intent,
            ...(params.sessionId ? { sessionId: params.sessionId } : {}),
            ...(typeof params.model === "string" && params.model ? { model: params.model } : {}),
            grantedPermissions: params.grantedPermissions ?? [],
            onSession: (session) => {
              sessionId = session.id;
              createdAt = new Date().toISOString();
              // CLI providers emit their real resume id only after the first prompt completes.
              if (!isPendingCliSession(params.provider, session.id)) persist(session.id, "RUNNING");
            },
            onEvent: (event) => { persistEvent(event); process.stdout.write(`${JSON.stringify({ type: "skill.event", id: request.id, skillId: params.skillId, event })}\n`); },
          }).then((result) => {
            persist(result.session.id, "COMPLETED");
            process.stdout.write(`${JSON.stringify({ id: request.id, result: { skillId: result.skill.id, sessionId: result.session.id, provider: params.provider ?? "opencode", events: result.events.length, status: "COMPLETED" } })}\n`);
          }).catch((error: unknown) => {
            if (sessionId) persist(sessionId, "FAILED");
            process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
          });
        }
      } else if (request.method === "skills.install") {
        const params = request.params;
        if (!params?.repositoryPath || !params.intent) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and source are required" } })}\n`);
        else if (skillSourceNeedsNetwork(params.intent) && !params.confirmed) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_INSTALL_CONFIRMATION_REQUIRED", message: "Installing a skill from the network requires explicit confirmation" } })}\n`);
        else void installProjectSkill({ repositoryPath: params.repositoryPath, source: params.intent }).then((skill) => process.stdout.write(`${JSON.stringify({ id: request.id, result: skill })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_INSTALL_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "skills.update") {
        const params = request.params;
        if (!params?.repositoryPath || !params.skillId) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and skillId are required" } })}\n`);
        else {
          const { repositoryPath, skillId, confirmed } = params;
          void projectSkillSourceNeedsNetwork({ repositoryPath, skillId }).then((needsNetwork) => {
            if (needsNetwork && !confirmed) {
              process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_UPDATE_CONFIRMATION_REQUIRED", message: "Updating a skill from the network requires explicit confirmation" } })}\n`);
              return;
            }
            return updateProjectSkill({ repositoryPath, skillId }).then((skill) => process.stdout.write(`${JSON.stringify({ id: request.id, result: { ...skill, updated: true } })}\n`));
          }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_UPDATE_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
        }
      } else if (request.method === "git.history") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void listGitCommits(directory).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "git.commit.diff") {
        const directory = request.params?.repositoryPath;
        const commit = request.params?.commit;
        if (!directory || !commit) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and commit are required" } })}\n`);
        else void readGitCommitDiff(directory, commit, request.params?.file).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "git.pending") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void inspectPendingGitChanges(directory).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "git.pending.diff") {
        const directory = request.params?.repositoryPath;
        const file = request.params?.file;
        if (!directory || !file) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and file are required" } })}\n`);
        else void readPendingGitDiff(directory, file).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "git.fetch.origin") {
        const params = request.params;
        if (!params?.repositoryPath || !params.actor || !params.reason) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath, actor and reason are required" } })}\n`);
        else void fetchOrigin({ directory: params.repositoryPath, actor: params.actor, reason: params.reason, confirmed: params.confirmed === true }).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error, "GIT_MUTATION_BLOCKED") })}\n`));
      } else if (request.method === "git.workspace") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void inspectGitWorkspace(directory).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "git.workflow") {
        const directory = request.params?.repositoryPath;
        process.stdout.write(`${JSON.stringify({ id: request.id, result: { gitWorkflow: loadGatePolicy(directory).gitWorkflow } })}\n`);
      } else if (request.method === "github.status") {
        void inspectGitHub().then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`));
      } else if (["git.branch.create", "git.branch.switch", "git.worktree.create", "git.commit.create", "git.commit.push", "git.push", "github.pr.create"].includes(request.method)) {
        const params = request.params;
        if (!params?.repositoryPath || !params.actor || !params.reason) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath, actor and reason are required" } })}\n`);
        else if ((request.method === "git.branch.create" || request.method === "git.commit.create" || request.method === "git.commit.push") && !params.intent) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "intent is required for this Git operation" } })}\n`);
        else if (request.method === "git.branch.switch" && !params.branch) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "branch is required for branch switching" } })}\n`);
        else if (request.method === "git.worktree.create" && (!params.worktreePath || !params.branch)) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "worktreePath and branch are required for a worktree" } })}\n`);
        else {
          const base = { directory: params.repositoryPath, actor: params.actor, reason: params.reason, confirmed: params.confirmed === true };
          const operation = request.method === "git.branch.create" ? createBranch({ ...base, name: params.intent! }) : request.method === "git.branch.switch" ? switchBranch({ ...base, branch: params.branch! }) : request.method === "git.worktree.create" ? createWorktree({ ...base, path: params.worktreePath!, branch: params.branch! }) : request.method === "git.commit.create" ? createCommit({ ...base, message: params.intent!, ...(params.body ? { body: params.body } : {}) }) : request.method === "git.commit.push" ? commitAndPush({ ...base, message: params.intent!, ...(params.body ? { body: params.body } : {}) }) : request.method === "git.push" ? pushBranch({ ...base, ...(params.intent ? { branch: params.intent } : {}) }) : createPullRequest({ ...base, title: params.intent ?? "ADE change", body: params.reason });
          void operation.then((result) => {
            if (params.taskId) {
              const candidate = "name" in result ? result.name : "url" in result ? result.url : "branch" in result ? result.branch : "commit" in result ? result.commit : undefined;
              const reference = typeof candidate === "string" ? candidate : undefined;
              store.saveGitOperation({ id: `git-${request.id}`, taskId: params.taskId, operation: result.operation, ...(reference ? { reference } : {}), actor: params.actor!, reason: params.reason!, metadata: JSON.stringify(result) });
            }
            process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
          }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error, "GIT_MUTATION_BLOCKED") })}\n`));
        }
      } else if (request.method === "knowledge.graph") {
        const root = request.params?.repositoryPath;
        if (!root) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void buildKnowledgeGraph(root).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`));
      } else if (request.method === "knowledge.reconcile") {
        const root = request.params?.repositoryPath;
        const changedFile = request.params?.intent;
        if (!root || !changedFile) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and changedFile are required" } })}\n`);
        else void proposeKnowledgeReconciliation(root, changedFile).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`));
      } else if (request.method === "knowledge.reconcile.apply") {
        const root = request.params?.repositoryPath;
        const changedFile = request.params?.intent;
        if (!root || !changedFile) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and changedFile are required" } })}\n`);
        else void applyKnowledgeReconciliation(root, changedFile).then((result) => {
          const taskId = request.params?.taskId;
          if (taskId) {
            const evidencePolicy = loadGatePolicy(root).evidence;
            store.saveRuntimeEvidence(createRuntimeEvidence({
              id: `documentation-${taskId}-${Date.now()}`,
              taskId,
              type: "documentation.reconciled",
              summary: `Reconciled ${result.changedFile}`,
              details: JSON.stringify({ affected: result.affected, broken: result.broken, artifacts: result.artifacts }),
              policy: evidencePolicy,
            }));
            store.pruneRuntimeEvidence(taskId, evidencePolicy.maxItems);
          }
          process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RECONCILIATION_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "knowledge.reconcile.changed") {
        const root = request.params?.repositoryPath;
        if (!root) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void reconcileChangedDocumentation(root).then((result) => {
          const taskId = request.params?.taskId;
          if (taskId && result.changedFiles.length) {
            const evidencePolicy = loadGatePolicy(root).evidence;
            store.saveRuntimeEvidence(createRuntimeEvidence({
              id: `documentation-${taskId}-${Date.now()}`,
              taskId,
              type: "documentation.reconciled",
              summary: `Reconciled ${result.changedFiles.length} changed documentation file(s)`,
              details: JSON.stringify({ changedFiles: result.changedFiles, affected: result.affected, broken: result.broken }),
              policy: evidencePolicy,
            }));
            store.pruneRuntimeEvidence(taskId, evidencePolicy.maxItems);
          }
          process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RECONCILIATION_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "knowledge.impact") {
        const target = request.params?.intent;
        const root = request.params?.repositoryPath;
        if (!target || !root) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and target are required" } })}\n`);
        else void findReferenceImpact(root, target).then((impact) => process.stdout.write(`${JSON.stringify({ id: request.id, result: impact })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "KNOWLEDGE_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "git.status") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void getGitStatus(directory).then((status) => process.stdout.write(`${JSON.stringify({ id: request.id, result: status })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: gitError(error) })}\n`));
      } else if (request.method === "service.start") {
        void startLocalService(request);
      } else if (request.method === "service.stop") {
        stopLocalService(request);
      } else if (request.method === "run.list") {
        void listRunConfigurations(request);
      } else if (request.method === "run.start") {
        void startRunConfiguration(store, request);
      } else if (request.method === "run.stop") {
        void stopRunConfiguration(request);
      } else if (request.method === "run.detect") {
        void detectRunConfigurationsFor(request);
      } else if (request.method === "toolchain.inspect") {
        void inspectProjectToolchainsFor(request);
      } else if (request.method === "run.save") {
        void saveRunConfigurationsFor(request);
      } else if (request.method === "terminal.history.save") {
        const response = handleDesktopRequest(store, request);
        process.stdout.write(`${JSON.stringify(response)}\n`);
        if (!response.error) void enrichTerminalHistoryTitle(store, request.params);
      } else {
        process.stdout.write(`${JSON.stringify(handleDesktopRequest(store, request))}\n`);
      }
    }
  } finally {
    input.close();
    /** The shell is going away; its runs go with it. A detached process that
        outlives the application is an orphan nobody can see or stop. */
    for (const manager of runManagers.values()) await manager.stopAll().catch(() => undefined);
    store.close();
  }
}

async function enrichTerminalHistoryTitle(store: AdeStore, params: DesktopRequest["params"]): Promise<void> {
  if (!params?.sessionId || !params.provider || !params.repositoryPath || !params.transcript) return;
  const provider = params.provider as TerminalAgentProvider;
  const runtime = provider === "claude" ? new ClaudeCliRuntime() : provider === "codex" ? new CodexCliRuntime() : new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
  const model = provider === "claude" ? "haiku" : provider === "codex" ? "gpt-5.6-luna" : undefined;
  try {
    const session = await runtime.createSession({ directory: params.repositoryPath, title: "Terminal history title" });
    const result = await runtime.promptAndWait(session, { text: `Return only a concise title, at most 60 characters, for this agent terminal transcript:\n${params.transcript.slice(0, 12_000)}`, ...(model ? { model } : {}), format: { type: "json_schema", schema: { type: "object", properties: { title: { type: "string", maxLength: 60 } }, required: ["title"] } } });
    const output = typeof (result as { output?: unknown })?.output === "string" ? (result as { output: string }).output : "";
    const title = terminalHistoryTitle(output);
    if (title) store.updateTerminalHistoryTitle(params.sessionId, title);
  } catch { /* The persisted fallback title remains usable without a provider. */ }
}

function terminalHistoryTitle(output: string): string {
  const trimmed = output.trim();
  try {
    const title = JSON.parse(trimmed) as Record<string, unknown>;
    const value = title.title ?? title.TITLE;
    if (typeof value === "string" && value.trim()) return value.trim().replace(/\s+/g, " ").slice(0, 60);
  } catch { /* Some providers return plain text. */ }
  return trimmed.startsWith("{") ? "Agent terminal session" : trimmed.replace(/^title\s*:\s*/i, "").replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").slice(0, 60);
}

async function runCatalog(repositoryPath: string): Promise<readonly ResolvedRunConfiguration[]> {
  const services = await loadServiceDefinitions(join(repositoryPath, ".ade", "services.json")).catch(() => []);
  return loadRunConfigurations(join(repositoryPath, ".ade", "run.json"), services);
}

function runManagerFor(store: AdeStore, repositoryPath: string): RunManager {
  const existing = runManagers.get(repositoryPath);
  if (existing) return existing;
  const manager = new RunManager(new LocalProcess(), new LocalPortProbe(), {
    projectRoot: repositoryPath,
    onOutput: (chunk) => {
      const run = verificationRuns.get(chunk.sessionId);
      if (run) appendVerificationOutput(run, chunk.text);
      process.stdout.write(`${JSON.stringify({ type: "run.output", repositoryPath, ...chunk })}\n`);
    },
    onSession: (session) => {
      const declared = pendingVerifications.get(`${repositoryPath}::${session.configurationId}`);
      if (declared && !verificationRuns.has(session.id)) {
        pendingVerifications.delete(`${repositoryPath}::${session.configurationId}`);
        verificationRuns.set(session.id, declared);
      }
      const run = verificationRuns.get(session.id);
      if (run && isTerminalRunState(session)) {
        verificationRuns.delete(session.id);
        try { recordVerificationRun(store, run, session); }
        catch (error: unknown) { process.stderr.write(`verification evidence failed: ${error instanceof Error ? error.message : String(error)}\n`); }
      }
      process.stdout.write(`${JSON.stringify({ type: "run.session", repositoryPath, session })}\n`);
    },
  });
  runManagers.set(repositoryPath, manager);
  return manager;
}

async function listRunConfigurations(request: DesktopRequest): Promise<void> {
  const repositoryPath = request.params?.repositoryPath;
  if (!repositoryPath) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
    return;
  }
  try {
    const configurations = await runCatalog(repositoryPath).catch((error: unknown) => {
      /** A Project without the file is the normal case, not a failure; an
          invalid file is a failure and must say which field. */
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    process.stdout.write(`${JSON.stringify({ id: request.id, result: { configurations, sessions: runManagers.get(repositoryPath)?.sessions() ?? [] } })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUN_CONFIG_INVALID", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

async function detectRunConfigurationsFor(request: DesktopRequest): Promise<void> {
  const repositoryPath = request.params?.repositoryPath;
  if (!repositoryPath) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify({ id: request.id, result: await detectRunConfigurations(repositoryPath) })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUN_DETECT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

async function inspectProjectToolchainsFor(request: DesktopRequest): Promise<void> {
  const repositoryPath = request.params?.repositoryPath;
  if (!repositoryPath) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify({ id: request.id, result: await inspectProjectToolchains(repositoryPath) })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "TOOLCHAIN_INSPECT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

async function saveRunConfigurationsFor(request: DesktopRequest): Promise<void> {
  const { repositoryPath, configurations } = request.params ?? {};
  if (!repositoryPath || !Array.isArray(configurations)) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and configurations are required" } })}\n`);
    return;
  }
  try {
    const services = await loadServiceDefinitions(join(repositoryPath, ".ade", "services.json")).catch(() => []);
    const saved = await saveRunConfigurations(join(repositoryPath, ".ade", "run.json"), configurations, services);
    process.stdout.write(`${JSON.stringify({ id: request.id, result: { configurations: saved } })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUN_CONFIG_INVALID", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

async function startRunConfiguration(store: AdeStore, request: DesktopRequest): Promise<void> {
  const { repositoryPath, configurationId, mode, taskId } = request.params ?? {};
  if (!repositoryPath || !configurationId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and configurationId are required" } })}\n`);
    return;
  }
  try {
    const catalog = await runCatalog(repositoryPath);
    const configuration = catalog.find((candidate) => candidate.id === configurationId);
    const manager = runManagerFor(store, repositoryPath);
    /** Registered before the run starts, because a fast command can finish
        before `start` returns and the session event would find no run. */
    if (configuration?.verifies && taskId) {
      pendingVerifications.set(`${repositoryPath}::${configurationId}`, { taskId, repositoryPath, verifies: configuration.verifies, label: configuration.label, output: "" });
    }
    const session = await manager.start(catalog, configurationId, mode ?? "run");
    process.stdout.write(`${JSON.stringify({ id: request.id, result: session })}\n`);
  } catch (error: unknown) {
    const code = error instanceof RunPortConflictError ? "RUN_PORT_CONFLICT" : "RUN_FAILED";
    const port = error instanceof RunPortConflictError ? { port: error.port } : {};
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code, message: error instanceof Error ? error.message : String(error), ...port } })}\n`);
  }
}

async function stopRunConfiguration(request: DesktopRequest): Promise<void> {
  const { repositoryPath, runSessionId } = request.params ?? {};
  const manager = repositoryPath ? runManagers.get(repositoryPath) : undefined;
  if (!manager || !runSessionId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and runSessionId are required" } })}\n`);
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify({ id: request.id, result: await manager.stop(runSessionId) })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUN_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

async function startLocalService(request: DesktopRequest): Promise<void> {
  const params = request.params ?? {};
  const projectServices = params.repositoryPath ? await loadServiceDefinitions(join(params.repositoryPath, ".ade", "services.json")).catch(() => []) : [];
  const available = projectServices.length ? projectServices : declaredServices;
  const declared = params.serviceId ? available.find((service) => service.id === params.serviceId) : available[0];
  const definition = declared ?? (params.serviceId && params.command && params.cwd ? { id: params.serviceId, command: params.command, cwd: params.cwd, ...(params.args ? { args: params.args } : {}) } : undefined);
  if (!serviceManager || !definition) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "serviceId must reference a declared service or provide command/cwd" } })}\n`);
    return;
  }
  void serviceManager.start(definition).then((status) => process.stdout.write(`${JSON.stringify({ id: request.id, result: { serviceId: definition.id, status } })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SERVICE_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
}

function stopLocalService(request: DesktopRequest): void {
  const serviceId = request.params?.serviceId;
  if (!serviceManager || !serviceId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "serviceId is required" } })}\n`);
    return;
  }
  void serviceManager.stop(serviceId).then((status) => process.stdout.write(`${JSON.stringify({ id: request.id, result: { serviceId, status } })}\n`));
}

function startTaskRereview(store: AdeStore, request: DesktopRequest): void {
  const taskId = request.params?.taskId;
  const task = taskId ? store.rehydrateTask(taskId) : undefined;
  const persisted = taskId ? store.listChangeSets(taskId)[0] : undefined;
  if (!taskId || !task || !persisted || !request.params?.reason || !request.params.actor) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "taskId, reason and actor are required" } })}\n`);
    return;
  }
  if (task.currentStatus !== "IMPLEMENTED") {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_TASK_STATE", message: `Task ${taskId} cannot be re-reviewed from ${task.currentStatus}` } })}\n`);
    return;
  }
  const changeSet: ChangeSet = { id: persisted.id, taskId: persisted.taskId, sessionId: persisted.sessionId, directory: persisted.directory, capturedAt: persisted.capturedAt, runtimeDiff: JSON.parse(persisted.runtimeDiff) as ChangeSet["runtimeDiff"], git: { status: persisted.gitStatus, patch: persisted.gitPatch, untracked: JSON.parse(persisted.untracked) as string[] } };
  process.stdout.write(`${JSON.stringify({ id: request.id, result: { accepted: true, taskId, status: "REVIEWING" } })}\n`);
  void reviewChangeSet(new OpenCodeReviewer(new OpenCodeHttpRuntime(process.env.OPENCODE_URL)), { task, changeSet, store, reason: request.params.reason, actor: request.params.actor }).then((review) => process.stdout.write(`${JSON.stringify({ type: "review.completed", taskId, review })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ type: "review.failed", taskId, error: error instanceof Error ? error.message : String(error) })}\n`));
}

async function checkRuntimeHealth(request: DesktopRequest): Promise<void> {
  try {
    const health = await new OpenCodeHttpRuntime(process.env.OPENCODE_URL).health();
    runtimeStatus.agentRuntime = health.healthy ? "CONNECTED" : "FAILED";
    runtimeStatus.lastError = health.healthy ? null : "OpenCode reported an unhealthy runtime";
    process.stdout.write(`${JSON.stringify({ id: request.id, result: { ...health, status: getRuntimeStatus() } })}\n`);
  } catch (error: unknown) {
    runtimeStatus.agentRuntime = "FAILED";
    runtimeStatus.lastError = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUNTIME_UNAVAILABLE", message: runtimeStatus.lastError }, status: getRuntimeStatus() })}\n`);
  }
}

async function abortAgentPrompt(request: DesktopRequest): Promise<void> {
  const requestId = request.params?.requestId;
  const active = requestId ? activeAgentPrompts.get(requestId) : undefined;
  if (!requestId || !active) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "AGENT_NOT_RUNNING", message: "No active agent turn matches this request" } })}\n`);
    return;
  }
  if (request.params?.projectId && active.projectId && request.params.projectId !== active.projectId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SESSION_PROJECT_MISMATCH", message: "This conversation belongs to another Project" } })}\n`);
    return;
  }
  active.aborted = true;
  active.eventAbortController?.abort();
  try {
    if (active.runtime && active.session) await active.runtime.abort(active.session);
    process.stdout.write(`${JSON.stringify({ id: request.id, result: { requestId, status: "STOPPING" } })}\n`);
  } catch (error: unknown) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "AGENT_ABORT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}

/** A refusal to ship names what is missing, because the operator's next move
    depends on which of the two it was. */
function shipError(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ShipBlockedError) return { code: "SHIP_BLOCKED", message };
  return { code: "SHIP_FAILED", message };
}

function startAgentPrompt(store: AdeStore, request: DesktopRequest): void {
  const params = request.params;
  if (!params?.provider || !params.repositoryPath || !params.prompt?.trim()) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "provider, repositoryPath and prompt are required" } })}\n`);
    return;
  }
  const provider = params.provider;
  if (provider !== "codex" && provider !== "claude" && provider !== "opencode") {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "PROVIDER_NOT_SUPPORTED", message: `Unsupported agent provider: ${provider}` } })}\n`);
    return;
  }
  const operationId = String(request.id);
  const active: ActiveAgentPrompt = { ...(params.projectId ? { projectId: params.projectId } : {}), aborted: false };
  activeAgentPrompts.set(operationId, active);
  void (async () => {
    const runtime = provider === "codex" ? new CodexCliRuntime() : provider === "claude" ? new ClaudeCliRuntime() : new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
    active.runtime = runtime;
    const existingSession = params.sessionId ? store.getAgentSession(params.sessionId) : undefined;
    if (existingSession && existingSession.provider !== provider) throw new Error("Choose New conversation before changing agent provider");
    if (existingSession?.projectId && params.projectId && existingSession.projectId !== params.projectId) throw new Error("This conversation belongs to another Project");
    const taskId = existingSession?.taskId ?? params.taskId;
    const projectId = existingSession?.projectId ?? params.projectId;
    const title = existingSession?.title ?? conversationTitle(params.prompt as string);
    const session = params.sessionId
      ? { id: params.sessionId, directory: params.repositoryPath! }
      : await runtime.createSession({ directory: params.repositoryPath!, title: `ADE ${title}` });
    active.session = session;
    const isPendingCli = isPendingCliSession(provider, session.id);
    /** A CLI session is named by the provider only when the turn ends, so
        anything recorded while it ran is filed under the placeholder id. */
    const pendingSessionId = session.id;
    const createdAt = new Date().toISOString();
    if (!isPendingCli) {
      store.saveAgentSession({ id: session.id, ...(projectId ? { projectId } : {}), ...(taskId ? { taskId } : {}), provider, directory: params.repositoryPath!, title, ...(typeof params.model === "string" ? { model: params.model } : {}), status: "RUNNING", createdAt });
    }
    process.stdout.write(`${JSON.stringify({ type: "agent.started", id: request.id, sessionId: session.id, provider, taskId: taskId ?? null, title })}\n`);
    const startedAtMs = Date.now();
    const eventTexts: string[] = [];
    const activity: Array<{ label: string; detail?: string; kind: "status" | "tool" }> = [];
    const streamState: AgentStreamState = { snapshots: new Map() };
    const eventAbortController = new AbortController();
    active.eventAbortController = eventAbortController;
    const recordAgentEvent = (event: import("./ports/agent-runtime.js").RuntimeEvent) => {
      const item = summarizeAgentActivity(event);
      if (item && !activity.some((candidate) => candidate.label === item.label && candidate.detail === item.detail)) {
        /** A provider announces a tool call before it knows what it is about and
            again once it does. The second is the same action, better told, so it
            replaces the first instead of standing beside it. */
        const vague = item.detail ? activity.findIndex((candidate) => candidate.label === item.label && !candidate.detail) : -1;
        if (vague >= 0) activity.splice(vague, 1, item);
        else activity.push(item);
        process.stdout.write(`${JSON.stringify({ type: "agent.activity", id: request.id, sessionId: session.id, item, ...(vague >= 0 ? { replaces: vague } : {}) })}\n`);
      }
      const delta = extractAgentOutputDelta(provider, event.payload, streamState);
      if (delta) process.stdout.write(`${JSON.stringify({ type: "agent.output", id: request.id, sessionId: session.id, text: delta })}\n`);
      /** Both CLIs report what the context window holds, and Codex also what
          its plan windows have spent, while the turn is still running. The
          shell should not have to wait for the turn to end to say so. */
      const reported = provider === "claude" ? extractClaudePressure(event.payload) : provider === "codex" ? extractCodexPressure(event.payload) : undefined;
      const merged = reported ? persistAgentPressure(store, provider, session.id, reported) : undefined;
      if (merged) process.stdout.write(`${JSON.stringify({ type: "agent.pressure", id: request.id, sessionId: session.id, provider, pressure: merged })}\n`);
    };
    // Activity and output are streamed as they happen, not only handed over
    // with the result. A turn that reports nothing until it finishes is
    // indistinguishable from a stalled one.
    const eventPromise = provider === "opencode"
      ? collectAgentEvents(runtime, eventTexts, eventAbortController, recordAgentEvent)
      : Promise.resolve();
    if (active.aborted) throw new Error("AGENT_TURN_ABORTED");
    /** A Java repository with ASK installed starts the turn knowing it: the
        agent decides whether to use it, but it can no longer fail to know that
        the structural answer is one command away instead of a tree walk. The
        conversation persists the operator's prompt, never the briefing. */
    const briefing = await askBriefing({ repositoryPath: params.repositoryPath!, enabled: loadGatePolicy(params.repositoryPath).structuralBriefing }).catch(() => undefined);
    const rawOutput = await runtime.prompt(session, { text: composeAgentPrompt(briefing, params.prompt!), ...(typeof params.model === "string" && params.model ? { model: params.model } : {}), grantedPermissions: params.grantedPermissions ?? [], ...(provider !== "opencode" ? { onEvent: recordAgentEvent } : {}) });
    await eventPromise;
    if (active.aborted) throw new Error("AGENT_TURN_ABORTED");
    if (isPendingCli && session.id.startsWith(`${provider}-pending-`)) throw new Error(`${provider} completed without reporting a resumable session id`);
    store.saveAgentSession({ id: session.id, ...(projectId ? { projectId } : {}), ...(taskId ? { taskId } : {}), provider, directory: params.repositoryPath!, title, ...(typeof params.model === "string" ? { model: params.model } : {}), status: "COMPLETED", createdAt });
    store.saveAgentMessage({ id: `agent-${request.id}-user`, sessionId: session.id, role: "user", content: params.prompt!, createdAt });
    const output = provider === "codex" ? extractCodexText(rawOutput) : provider === "claude" ? extractClaudeText(rawOutput) : streamState.output?.trim() || eventTexts.join("\n\n").trim();
    /** Routing a cheap turn to a cheap model is only worth doing once the turns
        are counted, so every completed turn records what the provider charged
        for it. A provider that reports nothing -- OpenCode today -- records
        nothing rather than a zero. */
    const usage = agentTurnUsage(store, provider, session.id, rawOutput);
    if (usage) store.saveAgentTurnUsage({ id: `agent-${request.id}-usage`, sessionId: session.id, provider, ...(typeof params.model === "string" && params.model ? { model: params.model } : {}), ...usage, createdAt: new Date().toISOString() });
    let files: readonly import("./ports/agent-runtime.js").FileDiff[] = [];
    try { files = await runtime.diff(session); } catch { /* A provider may not expose a diff for this turn. */ }
    /** The answer is what the conversation reads; the trace is what makes it
        checkable. Keeping them together is the whole point of the product, and
        a transcript that remembers only the reply throws the evidence away. */
    if (output) {
      store.saveAgentMessage({
        id: `agent-${request.id}-assistant`,
        sessionId: session.id,
        role: "assistant",
        content: output,
        createdAt: new Date().toISOString(),
        trace: {
          provider,
          ...(typeof params.model === "string" && params.model ? { model: params.model } : {}),
          durationMs: Date.now() - startedAtMs,
          ...(activity.length ? { activity } : {}),
          ...(files.length ? { files: files as ReadonlyArray<{ path?: string; additions?: number; deletions?: number }> } : {}),
          ...(usage ? { usage } : {}),
        },
      });
    }
    /** A turn that changed the repository under a Task enters the governance
        pipeline whichever provider ran it: the ChangeSet, the evidence and the
        Task's own progress no longer depend on `task.run` and OpenCode. */
    if (session.id !== pendingSessionId) store.renameAgentPressureSession(pendingSessionId, session.id);
    const capture = taskId
      ? await captureTurnChangeSet(store, {
          taskId,
          sessionId: session.id,
          directory: params.repositoryPath!,
          turnId: String(request.id),
          provider,
          ...(typeof params.model === "string" && params.model ? { model: params.model } : {}),
          runtimeDiff: files,
        }).catch((error: unknown) => { process.stderr.write(`change capture failed: ${error instanceof Error ? error.message : String(error)}\n`); return undefined; })
      : undefined;
    process.stdout.write(`${JSON.stringify({ id: request.id, result: { sessionId: session.id, provider, status: "COMPLETED", output, activity, files, ...(usage ? { usage } : {}), ...(capture ? { changeSetId: capture.changeSet.id, taskStatus: capture.taskStatus } : {}), pressure: readAgentPressure(store, provider, session.id) } })}\n`);
  })().catch((error: unknown) => {
    if (active.aborted) {
      const session = active.session;
      if (session && !isPendingCliSession(provider, session.id)) {
        store.saveAgentSession({ id: session.id, ...(params.projectId ? { projectId: params.projectId } : {}), ...(params.taskId ? { taskId: params.taskId } : {}), provider, directory: params.repositoryPath!, title: conversationTitle(params.prompt as string), status: "STOPPED", createdAt: new Date().toISOString() });
      }
      process.stdout.write(`${JSON.stringify({ type: "agent.stopped", id: request.id, sessionId: session?.id ?? null, provider, status: "STOPPED" })}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "AGENT_PROMPT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`);
    }
  }).finally(() => {
    activeAgentPrompts.delete(operationId);
  });
}

function conversationTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 69).trimEnd()}…` : normalized;
}

function isPendingCliSession(provider: string | undefined, sessionId: string): boolean {
  return (provider === "codex" || provider === "claude") && sessionId.startsWith(`${provider}-pending-`);
}

async function collectAgentEvents(
  runtime: import("./ports/agent-runtime.js").AgentRuntimePort,
  texts: string[],
  controller = new AbortController(),
  onEvent?: (event: import("./ports/agent-runtime.js").RuntimeEvent) => void,
): Promise<void> {
  const collect = (async () => {
    for await (const event of runtime.events(controller.signal)) {
      onEvent?.(event);
      const text = extractAgentEventText(event.payload);
      if (text && !texts.includes(text)) texts.push(text);
      const payload = event.payload as { type?: string };
      if (payload.type === "session.idle") break;
    }
  })();
  await Promise.race([collect, new Promise<void>((resolve) => setTimeout(resolve, 45_000))]);
  controller.abort();
}

type AgentStreamState = {
  snapshots: Map<string, string>;
  output?: string;
};

function extractAgentOutputDelta(provider: string, value: unknown, state: AgentStreamState): string {
  const payload = value as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return "";
  if (provider === "claude") {
    const nested = payload.event as Record<string, unknown> | undefined;
    const delta = nested?.delta as Record<string, unknown> | undefined;
    return typeof delta?.text === "string" && delta.type === "text_delta" ? appendStreamText(state, delta.text) : "";
  }
  if (provider === "codex") {
    const item = payload.item as Record<string, unknown> | undefined;
    if (item?.type === "agent_message" && typeof item.text === "string") {
      const id = typeof item.id === "string" ? item.id : "codex-agent-message";
      return appendStreamSnapshot(state, id, item.text);
    }
    if (typeof payload.delta === "string" && /output_text|text_delta/i.test(String(payload.type ?? ""))) return appendStreamText(state, payload.delta);
    return "";
  }
  const properties = payload.properties as Record<string, unknown> | undefined;
  const part = (properties?.part ?? payload.part) as Record<string, unknown> | undefined;
  const partText = typeof part?.text === "string" ? part.text : undefined;
  if (part?.type === "text" && partText) {
    const id = typeof part.id === "string" ? part.id : "opencode-text";
    return appendStreamSnapshot(state, id, partText);
  }
  if (typeof properties?.delta === "string") return appendStreamText(state, properties.delta);
  return "";
}

function appendStreamText(state: AgentStreamState, text: string): string {
  state.output = `${state.output ?? ""}${text}`;
  return text;
}

function appendStreamSnapshot(state: AgentStreamState, key: string, text: string): string {
  const previous = state.snapshots.get(key) ?? "";
  state.snapshots.set(key, text);
  const delta = text.startsWith(previous) ? text.slice(previous.length) : text;
  if (delta) state.output = `${state.output ?? ""}${delta}`;
  return delta;
}

export function summarizeAgentActivity(event: import("./ports/agent-runtime.js").RuntimeEvent): { label: string; detail?: string; kind: "status" | "tool" } | undefined {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return undefined;
  const nested = payload?.event as Record<string, unknown> | undefined;
  const nestedBlock = (nested?.content_block ?? nested?.contentBlock) as Record<string, unknown> | undefined;
  const message = payload?.message as Record<string, unknown> | undefined;
  const messageContent = Array.isArray(message?.content) ? message.content.find((candidate) => (candidate as Record<string, unknown>)?.type === "tool_use") as Record<string, unknown> | undefined : undefined;
  const item = payload?.item as Record<string, unknown> | undefined;
  const itemType = typeof item?.type === "string" ? item.type : undefined;
  const part = ((payload?.properties as Record<string, unknown> | undefined)?.part ?? payload?.part) as Record<string, unknown> | undefined;
  const partState = part?.state as Record<string, unknown> | undefined;
  const partInput = partState?.input as Record<string, unknown> | undefined;
  const rawType = typeof payload?.type === "string" ? payload.type : event.type;
  const properties = payload.properties as Record<string, unknown> | undefined;
  const itemInput = item?.input as Record<string, unknown> | undefined;
  const nestedInput = nestedBlock?.input as Record<string, unknown> | undefined;
  const messageInput = messageContent?.input as Record<string, unknown> | undefined;
  const toolName = [item?.tool, item?.name, part?.tool, part?.name, nestedBlock?.name, messageContent?.name, payload.tool, payload.name, properties?.tool, properties?.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const command = [payload.command, properties?.command, item?.command, itemInput?.command, partInput?.command, nestedInput?.command, messageInput?.command]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const file = [payload.path, payload.file, properties?.path, properties?.file, item?.path, item?.file, part?.path, part?.file, itemInput?.file_path, itemInput?.path, partInput?.file_path, partInput?.path, nestedInput?.file_path, nestedInput?.path, messageInput?.file_path, messageInput?.path]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  // Provider protocol milestones (thread/turn lifecycle, text chunks and
  // transient errors) are implementation detail, not progress. Only publish
  // actions an operator can use to understand what the agent is doing.
  if (itemType === "command_execution" && rawType === "item.started") return activity("Running command", command);
  if (itemType === "command_execution" && rawType === "item.completed" && typeof item?.exit_code === "number" && item.exit_code !== 0) {
    return activity(`Command failed (exit ${item.exit_code})`, command);
  }
  if (itemType === "file_change" && rawType === "item.started") return activity("Changing files", file);
  if (itemType === "mcp_tool_call" && rawType === "item.started") return activity("Calling tool", toolName);
  if (itemType === "web_search" && rawType === "item.started") return activity("Searching the web", command);

  if (part?.type === "tool" || nestedBlock?.type === "tool_use" || messageContent?.type === "tool_use") {
    return summarizeToolUse(toolName, command, file);
  }
  return undefined;
}

function activity(label: string, detail?: string): { label: string; detail?: string; kind: "tool" } {
  return { label, ...(detail ? { detail } : {}), kind: "tool" };
}

function summarizeToolUse(name: string | undefined, command: string | undefined, file: string | undefined): { label: string; detail?: string; kind: "tool" } | undefined {
  if (command) return activity("Running command", command);
  const normalized = name?.toLowerCase();
  if (["read", "view", "cat"].includes(normalized ?? "")) return activity("Reading file", file);
  if (["edit", "write", "patch", "apply_patch"].includes(normalized ?? "")) return activity("Changing file", file);
  if (["glob", "grep", "search"].includes(normalized ?? "")) return activity("Searching files", file);
  if (["webfetch", "websearch"].includes(normalized ?? "")) return activity(normalized === "websearch" ? "Searching the web" : "Fetching URL", file);
  return name ? activity(`Using ${name}`, file) : undefined;
}

function extractAgentEventText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : undefined;
  const item = value as Record<string, unknown>;
  const direct = [item.text, item.output, (item.item as Record<string, unknown> | undefined)?.text, (item.message as Record<string, unknown> | undefined)?.text, (item.part as Record<string, unknown> | undefined)?.text, (item.properties as Record<string, unknown> | undefined)?.text];
  const found = direct.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  if (found) return found.trim();
  const parts = item.parts;
  if (Array.isArray(parts)) return parts.map(extractAgentEventText).filter((candidate): candidate is string => Boolean(candidate)).join("\n").trim() || undefined;
  return undefined;
}

/** A window the provider did not report this time keeps what it last said:
    the account's five-hour and weekly windows outlive one turn, and the
    conversation's context is the last one measured. */
export function persistAgentPressure(store: AdeStore, provider: string, sessionId: string, reported: import("./ports/agent-runtime.js").ProviderPressure): import("./ports/agent-runtime.js").ProviderPressure {
  const windows = { ...(reported.session ? { session: reported.session } : {}), ...(reported.weekly ? { weekly: reported.weekly } : {}) };
  if (windows.session || windows.weekly) {
    const stored = (store.getAgentPressure(`provider:${provider}`)?.payload ?? {}) as import("./ports/agent-runtime.js").ProviderPressure;
    store.saveAgentPressure(`provider:${provider}`, { ...stored, ...windows });
  }
  if (reported.context) store.saveAgentPressure(`session:${sessionId}`, { context: reported.context });
  return readAgentPressure(store, provider, sessionId);
}

export function readAgentPressure(store: AdeStore, provider: string, sessionId?: string): import("./ports/agent-runtime.js").ProviderPressure & { updatedAt?: string; contextUpdatedAt?: string } {
  const windows = store.getAgentPressure(`provider:${provider}`);
  const context = sessionId ? store.getAgentPressure(`session:${sessionId}`) : undefined;
  const windowPayload = (windows?.payload ?? {}) as import("./ports/agent-runtime.js").ProviderPressure;
  const contextPayload = (context?.payload ?? {}) as import("./ports/agent-runtime.js").ProviderPressure;
  return {
    ...(windowPayload.session ? { session: windowPayload.session } : {}),
    ...(windowPayload.weekly ? { weekly: windowPayload.weekly } : {}),
    ...(contextPayload.context ? { context: contextPayload.context } : {}),
    ...(windows?.updatedAt ? { updatedAt: windows.updatedAt } : {}),
    ...(context?.updatedAt ? { contextUpdatedAt: context.updatedAt } : {}),
  };
}

/** Claude Code accounts for the turn that just ran; Codex reports a running
    total for the whole thread, so what this turn added is that total minus the
    turns already recorded. A total that went backwards -- a resumed thread the
    CLI recounts from zero -- is reported as read instead of as a negative. */
export function agentTurnUsage(store: AdeStore, provider: string, sessionId: string, rawOutput: unknown): import("./ports/agent-runtime.js").TurnUsage | undefined {
  if (provider === "claude") return extractClaudeUsage(rawOutput);
  if (provider !== "codex") return undefined;
  const total = extractCodexUsage(rawOutput);
  if (!total) return undefined;
  const recorded = store.agentSessionUsage(sessionId);
  const remaining = (current: number, already: number): number => (current >= already ? current - already : current);
  return {
    inputTokens: remaining(total.inputTokens, recorded.inputTokens),
    outputTokens: remaining(total.outputTokens, recorded.outputTokens),
    cacheReadInputTokens: remaining(total.cacheReadInputTokens, recorded.cacheReadInputTokens),
    cacheCreationInputTokens: remaining(total.cacheCreationInputTokens, recorded.cacheCreationInputTokens),
  };
}

function extractCodexText(value: unknown): string {
  if (typeof value !== "string") return value ? JSON.stringify(value) : "";
  const outputs: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const text = extractAgentEventText(event) ?? extractAgentEventText(event.message);
      if (text && !outputs.includes(text)) outputs.push(text);
    } catch { /* Codex may emit a human-readable line alongside JSONL. */ }
  }
  return outputs.join("\n\n").trim() || value.trim();
}

function startTaskRun(store: AdeStore, request: DesktopRequest): void {
  const taskId = request.params?.taskId;
  const task = taskId ? store.rehydrateTask(taskId) : undefined;
  if (!taskId || !task?.repositoryPath) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "taskId must reference a Task with a repositoryPath" } })}\n`);
    return;
  }
  if (!["READY", "CHANGES_REQUESTED", "BLOCKED"].includes(task.currentStatus)) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_TASK_STATE", message: `Task ${taskId} cannot run from ${task.currentStatus}` } })}\n`);
    return;
  }
  if (runtimeStatus.activeTaskId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUNTIME_BUSY", message: `Task ${runtimeStatus.activeTaskId} is already running` } })}\n`);
    return;
  }
  runtimeStatus.agentRuntime = "RUNNING";
  runtimeStatus.activeTaskId = taskId;
  runtimeStatus.lastError = null;
  process.stdout.write(`${JSON.stringify({ id: request.id, result: { accepted: true, taskId, status: "RUNNING" } })}\n`);
  /** The Implementer is whichever provider the caller asked for. Hardwiring
      OpenCode here kept the whole pipeline reachable by one runtime only. */
  const requested = request.params?.provider;
  const provider = requested === "claude" || requested === "codex" ? requested : "opencode";
  const runtime = provider === "claude" ? new ClaudeCliRuntime() : provider === "codex" ? new CodexCliRuntime() : new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
  void runSpike(runtime, {
    taskId,
    directory: task.repositoryPath,
    intent: task.intent,
    store,
    existingTask: true,
    ...(request.params?.grantedPermissions ? { grantedPermissions: request.params.grantedPermissions } : {}),
    onEvent: (event) => {
      runtimeStatus.lastEventAt = new Date().toISOString();
      const payload = event.payload as { type?: string; sessionID?: string; properties?: Record<string, unknown> };
      const evidencePolicy = loadGatePolicy(task.repositoryPath).evidence;
      store.saveRuntimeEvidence(createRuntimeEvidence({
        id: `runtime-${taskId}-${Date.now()}-${++runtimeEvidenceSequence}`,
        taskId,
        ...(payload.sessionID ? { sessionId: payload.sessionID } : {}),
        type: payload.type ?? event.type,
        at: runtimeStatus.lastEventAt,
        summary: payload.type ?? event.type,
        ...(payload.properties ? { details: JSON.stringify(payload.properties) } : {}),
        policy: evidencePolicy,
      }));
      store.pruneRuntimeEvidence(taskId, evidencePolicy.maxItems);
      process.stdout.write(`${JSON.stringify({ type: "runtime.event", taskId, event, status: getRuntimeStatus() })}\n`);
    },
  }).then(() => {
    runtimeStatus.agentRuntime = "CONNECTED";
    runtimeStatus.activeTaskId = null;
    process.stdout.write(`${JSON.stringify({ type: "runtime.completed", taskId, status: getRuntimeStatus() })}\n`);
  }).catch((error: unknown) => {
    const failedTask = store.rehydrateTask(taskId);
    if (failedTask?.currentStatus === "IN_PROGRESS") {
      failedTask.transition("BLOCKED", "Implementer execution failed", "ade");
      store.saveTask(failedTask);
    }
    runtimeStatus.agentRuntime = "FAILED";
    runtimeStatus.activeTaskId = null;
    runtimeStatus.lastError = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ type: "runtime.failed", taskId, status: getRuntimeStatus() })}\n`);
  });
}

const directEntrypoint = ["desktop-sidecar.ts", "desktop-sidecar.js", "desktop-sidecar.cjs"].some((name) => process.argv[1]?.endsWith(name));
if (directEntrypoint || isSea()) {
  runDesktopSidecar().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
