import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ChangeSet } from "../domain/change-set.js";
import { Task, type TaskEvent, type TaskStatus } from "../domain/task.js";
import type { Project, Repository } from "../domain/project.js";
import type { Review } from "../domain/review.js";
import type { RuntimeEvidence } from "../domain/runtime-evidence.js";
import type { Gate, GateStatus } from "../domain/gate.js";

export type PersistedTask = {
  id: string;
  intent: string;
  status: string;
  events: string;
  projectId: string | null;
  repositoryPath: string | null;
};

export type PersistedProject = {
  id: string;
  name: string;
  repositoryPath: string;
  gitRoot: string;
  versionControl: "git" | "none";
  branch: string | null;
  createdAt: string;
};

export type PersistedChangeSet = {
  id: string;
  taskId: string;
  sessionId: string;
  directory: string;
  capturedAt: string;
  runtimeDiff: string;
  gitStatus: string;
  gitPatch: string;
  untracked: string;
};

export type PersistedReview = {
  id: string;
  taskId: string;
  changeSetId: string;
  reviewer: string;
  sessionId?: string;
  createdAt: string;
  summary: string;
  status: string;
  findings: string;
};

export type PersistedRuntimeEvidence = RuntimeEvidence;
export type GitOperation = { id: string; taskId: string; operation: string; reference?: string; actor: string; reason: string; at: string; metadata?: string };
/** The way back from a writing turn: the working tree as it stood before the
    agent ran, kept as an unreferenced Git commit the Task can point at. */
export type TaskCheckpoint = { id: string; taskId: string; sessionId?: string; provider?: string; directory: string; ref: string; commit: string; label: string; files: number; createdAt: string; restoredAt?: string };
export type AgentSession = { id: string; projectId?: string; taskId?: string; provider: string; directory: string; title?: string; model?: string; status: string; createdAt: string; updatedAt: string };
/** What the turn did, kept with the answer it produced. A conversation that
    only remembers the reply throws away the evidence a developer needs: which
    commands ran, which files moved, what it cost. */
export type AgentTurnTrace = {
  provider?: string;
  model?: string;
  durationMs?: number;
  activity?: ReadonlyArray<{ label: string; detail?: string; kind: string }>;
  files?: ReadonlyArray<{ path?: string; additions?: number; deletions?: number }>;
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd?: number };
};

export type AgentMessage = { id: string; sessionId: string; role: "user" | "assistant" | "system"; content: string; createdAt: string; trace?: AgentTurnTrace };
export type AgentTurnUsage = { id: string; sessionId: string; provider: string; model?: string; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd?: number; createdAt: string };
/** What a conversation or a Task consumed, summed from the turns that reported
    it. A provider that reports nothing leaves no rows and therefore no totals:
    the absence of a measurement is not a measurement of zero. */
export type UsageTotals = { turns: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd?: number; turnsWithCost: number; providers: readonly string[]; models: readonly string[] };
export type TerminalHistorySession = { id: string; projectId: string; provider: "claude" | "codex" | "opencode"; title: string; transcript: string; truncated: boolean; startedAt: string; endedAt: string; providerSessionId?: string | undefined };

export class AdeStore {
  readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        intent TEXT NOT NULL,
        status TEXT NOT NULL,
        events_json TEXT NOT NULL,
        project_id TEXT,
        repository_path TEXT
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repository_path TEXT NOT NULL,
        git_root TEXT NOT NULL UNIQUE,
        branch TEXT,
        created_at TEXT NOT NULL,
        version_control TEXT NOT NULL DEFAULT 'git'
      );
      CREATE TABLE IF NOT EXISTS change_sets (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        session_id TEXT NOT NULL,
        directory TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        runtime_diff_json TEXT NOT NULL,
        git_status TEXT NOT NULL,
        git_patch TEXT NOT NULL,
        untracked_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        change_set_id TEXT NOT NULL REFERENCES change_sets(id),
        reviewer TEXT NOT NULL,
        session_id TEXT,
        created_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        findings_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runtime_evidence (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        session_id TEXT,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        summary TEXT NOT NULL,
        details TEXT
      );
      CREATE TABLE IF NOT EXISTS approvals (
        task_id TEXT PRIMARY KEY REFERENCES tasks(id),
        actor TEXT NOT NULL,
        reason TEXT NOT NULL,
        at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gates (
        task_id TEXT NOT NULL REFERENCES tasks(id),
        id TEXT NOT NULL,
        required INTEGER NOT NULL,
        status TEXT NOT NULL,
        evidence_ids_json TEXT NOT NULL,
        failure_reason TEXT,
        PRIMARY KEY (task_id, id)
      );
      CREATE TABLE IF NOT EXISTS git_operations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        operation TEXT NOT NULL,
        reference TEXT,
        actor TEXT NOT NULL,
        reason TEXT NOT NULL,
        at TEXT NOT NULL,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        session_id TEXT,
        provider TEXT,
        directory TEXT NOT NULL,
        ref TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        label TEXT NOT NULL,
        files INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        restored_at TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        task_id TEXT REFERENCES tasks(id),
        provider TEXT NOT NULL,
        directory TEXT NOT NULL,
        title TEXT,
        model TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_turn_usage (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cache_read_input_tokens INTEGER NOT NULL,
        cache_creation_input_tokens INTEGER NOT NULL,
        cost_usd REAL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_pressure (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS terminal_history_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        title TEXT NOT NULL,
        transcript TEXT NOT NULL,
        truncated INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        provider_session_id TEXT
      );
    `);
    this.migrateTasks();
    this.migrateChangeSets();
    this.migrateProjects();
    this.migrateAgentSessions();
    this.migrateAgentMessages();
    this.migrateTerminalHistorySessions();
  }

  private migrateTasks(): void {
    const columns = this.db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "project_id")) this.db.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT");
    if (!columns.some((column) => column.name === "repository_path")) this.db.exec("ALTER TABLE tasks ADD COLUMN repository_path TEXT");
  }

  /** Conversations recorded before the trace was kept simply have none, and
      must stay readable rather than be rewritten. */
  private migrateAgentMessages(): void {
    const columns = this.db.prepare("PRAGMA table_info(agent_messages)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "trace")) this.db.exec("ALTER TABLE agent_messages ADD COLUMN trace TEXT");
  }

  private migrateAgentSessions(): void {
    const columns = this.db.prepare("PRAGMA table_info(agent_sessions)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "project_id")) this.db.exec("ALTER TABLE agent_sessions ADD COLUMN project_id TEXT");
    if (!columns.some((column) => column.name === "title")) this.db.exec("ALTER TABLE agent_sessions ADD COLUMN title TEXT");
    if (!columns.some((column) => column.name === "model")) this.db.exec("ALTER TABLE agent_sessions ADD COLUMN model TEXT");
  }

  /** The table shipped before a terminal session could be tied to the agent's
      own conversation, so an existing database has no column to resume from. */
  private migrateTerminalHistorySessions(): void {
    const columns = this.db.prepare("PRAGMA table_info(terminal_history_sessions)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "provider_session_id")) this.db.exec("ALTER TABLE terminal_history_sessions ADD COLUMN provider_session_id TEXT");
  }

  private migrateChangeSets(): void {
    const columns = this.db.prepare("PRAGMA table_info(change_sets)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "directory")) {
      this.db.exec("ALTER TABLE change_sets ADD COLUMN directory TEXT NOT NULL DEFAULT ''");
    }
  }

  private migrateProjects(): void {
    const columns = this.db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "version_control")) this.db.exec("ALTER TABLE projects ADD COLUMN version_control TEXT NOT NULL DEFAULT 'git'");
  }

  saveTask(task: Task): void {
    this.db.prepare(`
      INSERT INTO tasks (id, intent, status, events_json, project_id, repository_path)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        intent = excluded.intent,
        status = excluded.status,
        events_json = excluded.events_json,
        project_id = excluded.project_id,
        repository_path = excluded.repository_path
    `).run(task.id, task.intent, task.currentStatus, JSON.stringify(task.history()), task.projectId ?? null, task.repositoryPath ?? null);
  }

  saveProject(project: Project, repository: Repository): void {
    this.db.prepare(`
      INSERT INTO projects (id, name, repository_path, git_root, branch, created_at, version_control)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        repository_path = excluded.repository_path,
        git_root = excluded.git_root,
        branch = excluded.branch,
        version_control = excluded.version_control
    `).run(project.id, project.name, project.repositoryPath, repository.gitRoot ?? project.repositoryPath, repository.branch ?? null, project.createdAt, repository.versionControl ?? "git");
  }

  removeProject(id: string): boolean {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  }

  saveChangeSet(changeSet: ChangeSet): void {
    this.db.prepare(`
      INSERT INTO change_sets (
        id, task_id, session_id, directory, captured_at, runtime_diff_json,
        git_status, git_patch, untracked_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      changeSet.id,
      changeSet.taskId,
      changeSet.sessionId,
      changeSet.directory,
      changeSet.capturedAt,
      JSON.stringify(changeSet.runtimeDiff),
      changeSet.git.status,
      changeSet.git.patch,
      JSON.stringify(changeSet.git.untracked),
    );
  }

  getTask(id: string): PersistedTask | undefined {
    return this.db.prepare("SELECT id, intent, status, events_json AS events, project_id AS projectId, repository_path AS repositoryPath FROM tasks WHERE id = ?").get(id) as PersistedTask | undefined;
  }

  listTasks(): PersistedTask[] {
    return this.db.prepare("SELECT id, intent, status, events_json AS events, project_id AS projectId, repository_path AS repositoryPath FROM tasks ORDER BY id").all() as PersistedTask[];
  }

  rehydrateTask(id: string): Task | undefined {
    const persisted = this.getTask(id);
    if (!persisted) return undefined;
    return Task.rehydrate({
      id: persisted.id,
      intent: persisted.intent,
      projectId: persisted.projectId ?? undefined,
      repositoryPath: persisted.repositoryPath ?? undefined,
      status: persisted.status as TaskStatus,
      events: JSON.parse(persisted.events) as TaskEvent[],
    });
  }

  getProject(id: string): PersistedProject | undefined {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt, version_control AS versionControl
      FROM projects WHERE id = ?
    `).get(id) as PersistedProject | undefined;
  }

  listProjects(): PersistedProject[] {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt, version_control AS versionControl
      FROM projects ORDER BY created_at, id
    `).all() as PersistedProject[];
  }

  getProjectByGitRoot(gitRoot: string): PersistedProject | undefined {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt, version_control AS versionControl
      FROM projects WHERE git_root = ?
    `).get(gitRoot) as PersistedProject | undefined;
  }

  getProjectByRepositoryPath(repositoryPath: string): PersistedProject | undefined {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt, version_control AS versionControl
      FROM projects WHERE repository_path = ?
    `).get(repositoryPath) as PersistedProject | undefined;
  }

  getChangeSet(id: string): PersistedChangeSet | undefined {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, session_id AS sessionId, directory,
             captured_at AS capturedAt,
             runtime_diff_json AS runtimeDiff, git_status AS gitStatus,
             git_patch AS gitPatch, untracked_json AS untracked
      FROM change_sets WHERE id = ?
    `).get(id) as PersistedChangeSet | undefined;
  }

  listChangeSets(taskId: string): PersistedChangeSet[] {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, session_id AS sessionId, directory,
             captured_at AS capturedAt, runtime_diff_json AS runtimeDiff,
             git_status AS gitStatus, git_patch AS gitPatch, untracked_json AS untracked
      FROM change_sets WHERE task_id = ? ORDER BY captured_at DESC, id DESC
    `).all(taskId) as PersistedChangeSet[];
  }

  saveReview(review: Review): void {
    this.db.prepare(`
      INSERT INTO reviews (
        id, task_id, change_set_id, reviewer, session_id, created_at,
        summary, status, findings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      review.id,
      review.taskId,
      review.changeSetId,
      review.reviewer,
      review.sessionId ?? null,
      review.createdAt,
      review.summary,
      review.status,
      JSON.stringify(review.findings),
    );
  }

  getReview(id: string): PersistedReview | undefined {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, change_set_id AS changeSetId,
             reviewer, session_id AS sessionId, created_at AS createdAt,
             summary, status, findings_json AS findings
      FROM reviews WHERE id = ?
    `).get(id) as PersistedReview | undefined;
  }

  listReviews(taskId: string): PersistedReview[] {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, change_set_id AS changeSetId,
             reviewer, session_id AS sessionId, created_at AS createdAt,
             summary, status, findings_json AS findings
      FROM reviews WHERE task_id = ? ORDER BY created_at DESC, id DESC
    `).all(taskId) as PersistedReview[];
  }

  saveRuntimeEvidence(evidence: RuntimeEvidence): void {
    this.db.prepare(`
      INSERT INTO runtime_evidence (id, task_id, session_id, type, at, summary, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id, session_id = excluded.session_id, type = excluded.type,
        at = excluded.at, summary = excluded.summary, details = excluded.details
    `).run(evidence.id, evidence.taskId, evidence.sessionId ?? null, evidence.type, evidence.at, evidence.summary, evidence.details ?? null);
  }

  listRuntimeEvidence(taskId: string, limit = 100): PersistedRuntimeEvidence[] {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, session_id AS sessionId, type, at, summary, details
      FROM runtime_evidence WHERE task_id = ? ORDER BY at DESC, id DESC LIMIT ?
    `).all(taskId, limit) as PersistedRuntimeEvidence[];
  }

  pruneRuntimeEvidence(taskId: string, maxItems: number): void {
    this.db.prepare(`DELETE FROM runtime_evidence WHERE task_id = ? AND id NOT IN (SELECT id FROM runtime_evidence WHERE task_id = ? ORDER BY at DESC, id DESC LIMIT ?)`).run(taskId, taskId, maxItems);
  }

  saveGitOperation(input: Omit<GitOperation, "at"> & { at?: string }): void {
    this.db.prepare(`INSERT INTO git_operations (id, task_id, operation, reference, actor, reason, at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET reference = excluded.reference, metadata = excluded.metadata`).run(input.id, input.taskId, input.operation, input.reference ?? null, input.actor, input.reason, input.at ?? new Date().toISOString(), input.metadata ?? null);
  }

  listGitOperations(taskId: string): GitOperation[] {
    return this.db.prepare(`SELECT id, task_id AS taskId, operation, reference, actor, reason, at, metadata FROM git_operations WHERE task_id = ? ORDER BY at DESC, id DESC`).all(taskId) as GitOperation[];
  }

  saveAgentSession(input: Omit<AgentSession, "updatedAt"> & { updatedAt?: string }): void {
    const updatedAt = input.updatedAt ?? new Date().toISOString();
    this.db.prepare(`INSERT INTO agent_sessions (id, project_id, task_id, provider, directory, title, model, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET project_id = COALESCE(excluded.project_id, agent_sessions.project_id), task_id = COALESCE(excluded.task_id, agent_sessions.task_id), provider = excluded.provider, directory = excluded.directory, title = COALESCE(excluded.title, agent_sessions.title), model = COALESCE(excluded.model, agent_sessions.model), status = excluded.status, updated_at = excluded.updated_at`).run(input.id, input.projectId ?? null, input.taskId ?? null, input.provider, input.directory, input.title ?? null, input.model ?? null, input.status, input.createdAt, updatedAt);
  }

  listAgentSessions(taskId?: string): AgentSession[] {
    const query = taskId ? `SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE task_id = ? ORDER BY updated_at DESC` : `SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions ORDER BY updated_at DESC`;
    return (taskId ? this.db.prepare(query).all(taskId) : this.db.prepare(query).all()) as AgentSession[];
  }

  getAgentSession(sessionId: string): AgentSession | undefined {
    return this.db.prepare(`SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE id = ?`).get(sessionId) as AgentSession | undefined;
  }

  listAgentSessionsForProject(projectId: string | undefined, directory: string | undefined): AgentSession[] {
    if (!projectId && !directory) return [];
    const query = projectId && directory
      ? `SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE project_id = ? OR (project_id IS NULL AND directory = ?) ORDER BY updated_at DESC`
      : projectId
        ? `SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE project_id = ? ORDER BY updated_at DESC`
        : `SELECT id, project_id AS projectId, task_id AS taskId, provider, directory, title, model, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE directory = ? ORDER BY updated_at DESC`;
    const params = projectId && directory ? [projectId, directory] : [projectId ?? directory ?? ""];
    return this.db.prepare(query).all(...params) as AgentSession[];
  }

  deleteAgentSession(sessionId: string): void {
    this.db.prepare("DELETE FROM agent_sessions WHERE id = ?").run(sessionId);
  }

  saveTerminalHistorySession(session: TerminalHistorySession): void {
    this.db.prepare(`INSERT INTO terminal_history_sessions (id, project_id, provider, title, transcript, truncated, started_at, ended_at, provider_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, transcript = excluded.transcript, truncated = excluded.truncated, ended_at = excluded.ended_at, provider_session_id = COALESCE(excluded.provider_session_id, terminal_history_sessions.provider_session_id)`).run(session.id, session.projectId, session.provider, session.title, session.transcript, Number(session.truncated), session.startedAt, session.endedAt, session.providerSessionId ?? null);
  }

  listTerminalHistorySessions(projectId: string): TerminalHistorySession[] {
    return this.db.prepare(`SELECT id, project_id AS projectId, provider, title, transcript, truncated, started_at AS startedAt, ended_at AS endedAt, provider_session_id AS providerSessionId FROM terminal_history_sessions WHERE project_id = ? ORDER BY ended_at DESC, id DESC`).all(projectId).map((session) => ({ ...(session as Omit<TerminalHistorySession, "truncated">), truncated: Boolean((session as { truncated: number }).truncated), providerSessionId: (session as { providerSessionId: string | null }).providerSessionId ?? undefined }));
  }

  getTerminalHistorySession(id: string): TerminalHistorySession | undefined {
    const session = this.db.prepare(`SELECT id, project_id AS projectId, provider, title, transcript, truncated, started_at AS startedAt, ended_at AS endedAt, provider_session_id AS providerSessionId FROM terminal_history_sessions WHERE id = ?`).get(id) as (Omit<TerminalHistorySession, "truncated"> & { truncated: number }) | undefined;
    return session ? { ...session, truncated: Boolean(session.truncated), providerSessionId: (session as { providerSessionId?: string | null }).providerSessionId ?? undefined } : undefined;
  }

  deleteTerminalHistorySession(id: string): void {
    this.db.prepare("DELETE FROM terminal_history_sessions WHERE id = ?").run(id);
  }

  updateTerminalHistoryTitle(id: string, title: string): void {
    this.db.prepare("UPDATE terminal_history_sessions SET title = ? WHERE id = ?").run(title.slice(0, 60), id);
  }

  saveAgentMessage(input: Omit<AgentMessage, "createdAt"> & { createdAt?: string }): void {
    const trace = input.trace ? JSON.stringify(input.trace) : null;
    this.db.prepare(`INSERT INTO agent_messages (id, session_id, role, content, created_at, trace) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, trace = COALESCE(excluded.trace, agent_messages.trace)`).run(input.id, input.sessionId, input.role, input.content, input.createdAt ?? new Date().toISOString(), trace);
  }

  /** One row per completed turn. A turn the provider did not account for has
      no row: an absent cost is not a free one. */
  saveTaskCheckpoint(input: Omit<TaskCheckpoint, "createdAt"> & { createdAt?: string }): void {
    this.db.prepare(`INSERT INTO task_checkpoints (id, task_id, session_id, provider, directory, ref, commit_hash, label, files, created_at, restored_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET restored_at = excluded.restored_at`)
      .run(input.id, input.taskId, input.sessionId ?? null, input.provider ?? null, input.directory, input.ref, input.commit, input.label, input.files, input.createdAt ?? new Date().toISOString(), input.restoredAt ?? null);
  }

  listTaskCheckpoints(taskId: string): TaskCheckpoint[] {
    return this.db.prepare(`SELECT id, task_id AS taskId, session_id AS sessionId, provider, directory, ref, commit_hash AS "commit", label, files, created_at AS createdAt, restored_at AS restoredAt FROM task_checkpoints WHERE task_id = ? ORDER BY created_at DESC, id DESC`)
      .all(taskId)
      .map((row) => readTaskCheckpoint(row));
  }

  getTaskCheckpoint(id: string): TaskCheckpoint | undefined {
    const row = this.db.prepare(`SELECT id, task_id AS taskId, session_id AS sessionId, provider, directory, ref, commit_hash AS "commit", label, files, created_at AS createdAt, restored_at AS restoredAt FROM task_checkpoints WHERE id = ?`).get(id);
    return row ? readTaskCheckpoint(row) : undefined;
  }

  markTaskCheckpointRestored(id: string, at = new Date().toISOString()): void {
    this.db.prepare("UPDATE task_checkpoints SET restored_at = ? WHERE id = ?").run(at, id);
  }

  saveAgentTurnUsage(input: Omit<AgentTurnUsage, "createdAt"> & { createdAt?: string }): void {
    this.db.prepare(`INSERT INTO agent_turn_usage (id, session_id, provider, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens, cache_read_input_tokens = excluded.cache_read_input_tokens, cache_creation_input_tokens = excluded.cache_creation_input_tokens, cost_usd = excluded.cost_usd`)
      .run(input.id, input.sessionId, input.provider, input.model ?? null, input.inputTokens, input.outputTokens, input.cacheReadInputTokens, input.cacheCreationInputTokens, input.costUsd ?? null, input.createdAt ?? new Date().toISOString());
  }

  listAgentTurnUsage(sessionId: string): AgentTurnUsage[] {
    return this.db.prepare(`SELECT id, session_id AS sessionId, provider, model, input_tokens AS inputTokens, output_tokens AS outputTokens, cache_read_input_tokens AS cacheReadInputTokens, cache_creation_input_tokens AS cacheCreationInputTokens, cost_usd AS costUsd, created_at AS createdAt FROM agent_turn_usage WHERE session_id = ? ORDER BY created_at ASC, id ASC`).all(sessionId)
      .map((row) => {
        const { model, costUsd, ...usage } = row as Omit<AgentTurnUsage, "model" | "costUsd"> & { model: string | null; costUsd: number | null };
        return { ...usage, ...(model ? { model } : {}), ...(typeof costUsd === "number" ? { costUsd } : {}) };
      });
  }

  /** What the session has spent so far, summed from its turns. Codex reports a
      running thread total instead of a per-turn one, so the sidecar needs this
      to reduce it back to the turn that just ran. */
  agentSessionUsage(sessionId: string): { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd: number } {
    const row = this.db.prepare(`SELECT COALESCE(SUM(input_tokens), 0) AS inputTokens, COALESCE(SUM(output_tokens), 0) AS outputTokens, COALESCE(SUM(cache_read_input_tokens), 0) AS cacheReadInputTokens, COALESCE(SUM(cache_creation_input_tokens), 0) AS cacheCreationInputTokens, COALESCE(SUM(cost_usd), 0) AS costUsd FROM agent_turn_usage WHERE session_id = ?`).get(sessionId);
    const totals = row as { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd: number };
    return { inputTokens: totals.inputTokens, outputTokens: totals.outputTokens, cacheReadInputTokens: totals.cacheReadInputTokens, cacheCreationInputTokens: totals.cacheCreationInputTokens, costUsd: totals.costUsd };
  }

  /** What a conversation consumed in total. Undefined -- not zero -- when no
      turn of it was ever accounted for, so a surface can say "unknown" instead
      of claiming a conversation was free. */
  agentSessionUsageTotals(sessionId: string): UsageTotals | undefined {
    return this.usageTotals("WHERE session_id = ?", [sessionId]);
  }

  /** The same question asked of a Task, across every conversation held under
      it: what has this piece of work cost so far. */
  taskUsageTotals(taskId: string): UsageTotals | undefined {
    return this.usageTotals("WHERE session_id IN (SELECT id FROM agent_sessions WHERE task_id = ?)", [taskId]);
  }

  private usageTotals(where: string, parameters: readonly string[]): UsageTotals | undefined {
    const row = this.db.prepare(`SELECT COUNT(*) AS turns, COUNT(cost_usd) AS turnsWithCost, COALESCE(SUM(input_tokens), 0) AS inputTokens, COALESCE(SUM(output_tokens), 0) AS outputTokens, COALESCE(SUM(cache_read_input_tokens), 0) AS cacheReadInputTokens, COALESCE(SUM(cache_creation_input_tokens), 0) AS cacheCreationInputTokens, SUM(cost_usd) AS costUsd FROM agent_turn_usage ${where}`).get(...parameters) as { turns: number; turnsWithCost: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUsd: number | null };
    if (!row || !row.turns) return undefined;
    const named = this.db.prepare(`SELECT DISTINCT provider, model FROM agent_turn_usage ${where}`).all(...parameters) as Array<{ provider: string; model: string | null }>;
    return {
      turns: Number(row.turns),
      turnsWithCost: Number(row.turnsWithCost),
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      cacheReadInputTokens: Number(row.cacheReadInputTokens),
      cacheCreationInputTokens: Number(row.cacheCreationInputTokens),
      /** A cost only exists when a provider declared one; summing nulls as zero
          would turn "not priced" into "free". */
      ...(row.turnsWithCost && typeof row.costUsd === "number" ? { costUsd: row.costUsd } : {}),
      providers: [...new Set(named.map((item) => item.provider))],
      models: [...new Set(named.map((item) => item.model).filter((model): model is string => Boolean(model)))],
    };
  }

  /** What a provider last said about its own limits, and what a conversation
      last had in its context window. Kept apart from the turn rows because a
      plan window belongs to the account and outlives any single conversation. */
  saveAgentPressure(id: string, payload: unknown, updatedAt = new Date().toISOString()): void {
    this.db.prepare("INSERT INTO agent_pressure (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").run(id, JSON.stringify(payload), updatedAt);
  }

  getAgentPressure(id: string): { payload: unknown; updatedAt: string } | undefined {
    const row = this.db.prepare("SELECT payload, updated_at AS updatedAt FROM agent_pressure WHERE id = ?").get(id) as { payload: string; updatedAt: string } | undefined;
    if (!row) return undefined;
    try { return { payload: JSON.parse(row.payload), updatedAt: row.updatedAt }; } catch { return undefined; }
  }

  /** A CLI conversation is only named when its first turn ends, so what was
      measured while it ran has to follow it to its real id or the dials would
      read empty for the conversation that just reported them. */
  renameAgentPressureSession(from: string, to: string): void {
    const previous = this.getAgentPressure(`session:${from}`);
    if (!previous) return;
    this.saveAgentPressure(`session:${to}`, previous.payload, previous.updatedAt);
    this.db.prepare("DELETE FROM agent_pressure WHERE id = ?").run(`session:${from}`);
  }

  listAgentMessages(sessionId: string): AgentMessage[] {
    const rows = this.db.prepare(`SELECT id, session_id AS sessionId, role, content, created_at AS createdAt, trace FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`).all(sessionId) as Array<AgentMessage & { trace: string | null }>;
    return rows.map(({ trace, ...message }) => {
      if (!trace) return message;
      /** A trace that cannot be read is not worth failing the conversation for. */
      try { return { ...message, trace: JSON.parse(trace) as AgentTurnTrace }; } catch { return message; }
    });
  }

  saveApproval(input: { taskId: string; actor: string; reason: string; at?: string }): void {
    this.db.prepare(`INSERT INTO approvals (task_id, actor, reason, at) VALUES (?, ?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET actor = excluded.actor, reason = excluded.reason, at = excluded.at`).run(input.taskId, input.actor, input.reason, input.at ?? new Date().toISOString());
  }

  getApproval(taskId: string): { taskId: string; actor: string; reason: string; at: string } | undefined {
    return this.db.prepare("SELECT task_id AS taskId, actor, reason, at FROM approvals WHERE task_id = ?").get(taskId) as { taskId: string; actor: string; reason: string; at: string } | undefined;
  }

  saveGates(taskId: string, gates: readonly Gate[]): void {
    const statement = this.db.prepare(`
      INSERT INTO gates (task_id, id, required, status, evidence_ids_json, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, id) DO UPDATE SET required = excluded.required,
        status = excluded.status, evidence_ids_json = excluded.evidence_ids_json,
        failure_reason = excluded.failure_reason
    `);
    for (const gate of gates) statement.run(taskId, gate.id, gate.required ? 1 : 0, gate.status, JSON.stringify(gate.evidenceIds), gate.failureReason ?? null);
  }

  listGates(taskId: string): Gate[] {
    const rows = this.db.prepare(`SELECT id, required, status, evidence_ids_json AS evidenceIds, failure_reason AS failureReason FROM gates WHERE task_id = ? ORDER BY id`).all(taskId) as Array<{ id: string; required: number; status: string; evidenceIds: string; failureReason: string | null }>;
    return rows.map((row) => ({ id: row.id, required: row.required === 1, status: row.status as GateStatus, evidenceIds: JSON.parse(row.evidenceIds) as string[], ...(row.failureReason ? { failureReason: row.failureReason } : {}) }));
  }

  close(): void {
    this.db.close();
  }
}

/** A checkpoint that was never restored has no restore time, and a session or
    provider is optional because a checkpoint can also be taken by hand. */
function readTaskCheckpoint(row: unknown): TaskCheckpoint {
  const { sessionId, provider, restoredAt, files, ...rest } = row as Omit<TaskCheckpoint, "sessionId" | "provider" | "restoredAt" | "files"> & { sessionId: string | null; provider: string | null; restoredAt: string | null; files: number };
  return {
    ...rest,
    files: Number(files),
    ...(sessionId ? { sessionId } : {}),
    ...(provider ? { provider } : {}),
    ...(restoredAt ? { restoredAt } : {}),
  };
}
