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
export type AgentSession = { id: string; taskId?: string; provider: string; directory: string; status: string; createdAt: string; updatedAt: string };

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
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id),
        provider TEXT NOT NULL,
        directory TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.migrateTasks();
    this.migrateChangeSets();
    this.migrateProjects();
  }

  private migrateTasks(): void {
    const columns = this.db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "project_id")) this.db.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT");
    if (!columns.some((column) => column.name === "repository_path")) this.db.exec("ALTER TABLE tasks ADD COLUMN repository_path TEXT");
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
    this.db.prepare(`INSERT INTO agent_sessions (id, task_id, provider, directory, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET task_id = excluded.task_id, provider = excluded.provider, directory = excluded.directory, status = excluded.status, updated_at = excluded.updated_at`).run(input.id, input.taskId ?? null, input.provider, input.directory, input.status, input.createdAt, updatedAt);
  }

  listAgentSessions(taskId?: string): AgentSession[] {
    const query = taskId ? `SELECT id, task_id AS taskId, provider, directory, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions WHERE task_id = ? ORDER BY updated_at DESC` : `SELECT id, task_id AS taskId, provider, directory, status, created_at AS createdAt, updated_at AS updatedAt FROM agent_sessions ORDER BY updated_at DESC`;
    return (taskId ? this.db.prepare(query).all(taskId) : this.db.prepare(query).all()) as AgentSession[];
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
