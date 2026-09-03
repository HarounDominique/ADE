import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";
import { advanceTask, createTask } from "./application/tasks/task-commands.js";
import type { TaskStatus } from "./domain/task.js";
import { AdeStore } from "./persistence/sqlite-store.js";
import { getProjectSnapshot } from "./application/project-snapshot.js";
import { OpenCodeHttpRuntime } from "./adapters/opencode-http-runtime.js";
import { CodexCliRuntime } from "./adapters/codex-cli-runtime.js";
import { runSpike } from "./application/run-spike.js";
import { createRuntimeEvidence } from "./domain/runtime-evidence.js";
import { getRuntimeHistory, getTaskDetail } from "./application/task-detail.js";
import { getChangeReview } from "./application/change-review-read-model.js";
import { approveTaskFromStore } from "./application/tasks/approval-from-store.js";
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
import { inspectGitWorkspace } from "./application/git/workspace-status.js";
import { inspectGitHub } from "./application/git/github-status.js";
import { createBranch, createCommit, createPullRequest, createWorktree } from "./application/git/git-mutations.js";
import { buildKnowledgeGraph } from "./application/knowledge/knowledge-graph.js";
import { loadServiceDefinitions } from "./application/local-runtime/service-config.js";
import { proposeKnowledgeReconciliation } from "./application/knowledge/reconcile.js";
import { loadGatePolicy } from "./application/change-review/gate-policy.js";

export type DesktopRequest = {
  id: string | number;
  method: string;
  params?: { projectId?: string; taskId?: string; intent?: string; skillId?: string; provider?: string; sessionId?: string; repositoryPath?: string; next?: TaskStatus; reason?: string; actor?: string; confirmed?: boolean; serviceId?: string; command?: string; args?: string[]; cwd?: string };
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

function getRuntimeStatus(): RuntimeStatus {
  return {
    ...runtimeStatus,
  };
}

export function handleDesktopRequest(store: AdeStore, request: DesktopRequest): DesktopResponse {
  try {
    if (!['project.snapshot', 'task.create', 'task.advance', 'runtime.status', 'task.detail', 'runtime.history', 'change.review', 'task.approve', 'task.git.operations', 'runtime.sessions', 'service.status', 'service.list', 'skills.list'].includes(request.method)) {
      return { id: request.id, error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${request.method}` } };
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
    if (request.method === "skills.list") return { id: request.id, result: listNativeSkills() };
    if (request.method === "service.status") {
      const serviceId = request.params?.serviceId;
      if (!serviceId || !serviceManager) return { id: request.id, error: { code: "INVALID_PARAMS", message: "serviceId is required" } };
      return { id: request.id, result: { serviceId, status: serviceManager.status(serviceId) } };
    }
    if (request.method === "service.list") return { id: request.id, result: declaredServices.map((service) => ({ id: service.id, command: service.command, cwd: service.cwd, healthcheck: service.healthcheck ? true : false })) };
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
      } else if (request.method === "task.run") {
        startTaskRun(store, request);
      } else if (request.method === "task.rereview") {
        startTaskRereview(store, request);
      } else if (request.method === "providers.inspect") {
        void inspectProviders(process.env.OPENCODE_URL ? { opencodeUrl: process.env.OPENCODE_URL } : {})
          .then((providers) => process.stdout.write(`${JSON.stringify({ id: request.id, result: providers })}\n`))
          .catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "PROVIDERS_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "skills.run") {
        const params = request.params;
        if (!params?.skillId || !params.intent || !params.repositoryPath) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "skillId, intent and repositoryPath are required" } })}\n`);
        else {
          const runtime = params.provider === "codex" ? new CodexCliRuntime() : new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
          void runNativeSkill(runtime, { skillId: params.skillId, directory: params.repositoryPath, intent: params.intent, ...(params.sessionId ? { sessionId: params.sessionId } : {}) }).then((result) => { store.saveAgentSession({ id: result.session.id, ...(params.taskId ? { taskId: params.taskId } : {}), provider: params.provider ?? "opencode", directory: params.repositoryPath!, status: "COMPLETED", createdAt: new Date().toISOString() }); process.stdout.write(`${JSON.stringify({ id: request.id, result: { skillId: result.skill.id, sessionId: result.session.id, provider: params.provider ?? "opencode", status: "COMPLETED" } })}\n`); }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "SKILL_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
        }
      } else if (request.method === "git.workspace") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void inspectGitWorkspace(directory).then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "GIT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "github.status") {
        void inspectGitHub().then((result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`));
      } else if (["git.branch.create", "git.worktree.create", "git.commit.create", "github.pr.create"].includes(request.method)) {
        const params = request.params;
        if (!params?.repositoryPath || !params.actor || !params.reason) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath, actor and reason are required" } })}\n`);
        else {
          const base = { directory: params.repositoryPath, actor: params.actor, reason: params.reason, confirmed: params.confirmed === true };
          const operation = request.method === "git.branch.create" && params.intent ? createBranch({ ...base, name: params.intent }) : request.method === "git.worktree.create" && params.intent ? createWorktree({ ...base, path: params.intent, branch: params.intent }) : request.method === "git.commit.create" && params.intent ? createCommit({ ...base, message: params.intent }) : createPullRequest({ ...base, title: params.intent ?? "ADE change", body: params.reason });
          void operation.then((result) => {
            if (params.taskId) {
              const reference = "name" in result ? result.name : "url" in result ? result.url : "branch" in result ? result.branch : undefined;
              store.saveGitOperation({ id: `git-${request.id}`, taskId: params.taskId, operation: result.operation, ...(reference ? { reference } : {}), actor: params.actor!, reason: params.reason!, metadata: JSON.stringify(result) });
            }
            process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
          }).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "GIT_MUTATION_BLOCKED", message: error instanceof Error ? error.message : String(error) } })}\n`));
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
      } else if (request.method === "knowledge.impact") {
        const target = request.params?.intent;
        const root = request.params?.repositoryPath;
        if (!target || !root) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath and target are required" } })}\n`);
        else void findReferenceImpact(root, target).then((impact) => process.stdout.write(`${JSON.stringify({ id: request.id, result: impact })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "KNOWLEDGE_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "git.status") {
        const directory = request.params?.repositoryPath;
        if (!directory) process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "repositoryPath is required" } })}\n`);
        else void getGitStatus(directory).then((status) => process.stdout.write(`${JSON.stringify({ id: request.id, result: status })}\n`)).catch((error: unknown) => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "GIT_FAILED", message: error instanceof Error ? error.message : String(error) } })}\n`));
      } else if (request.method === "service.start") {
        startLocalService(request);
      } else if (request.method === "service.stop") {
        stopLocalService(request);
      } else {
        process.stdout.write(`${JSON.stringify(handleDesktopRequest(store, request))}\n`);
      }
    }
  } finally {
    input.close();
    store.close();
  }
}

function startLocalService(request: DesktopRequest): void {
  const params = request.params ?? {};
  const declared = params.serviceId ? declaredServices.find((service) => service.id === params.serviceId) : undefined;
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
  void runSpike(new OpenCodeHttpRuntime(process.env.OPENCODE_URL), {
    taskId,
    directory: task.repositoryPath,
    intent: task.intent,
    store,
    existingTask: true,
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
