import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ChangeSet } from "../domain/change-set.js";
import { Task, type TaskEvent, type TaskStatus } from "../domain/task.js";
import type { Project, Repository } from "../domain/project.js";
import type { Review } from "../domain/review.js";
import type { RuntimeEvidence } from "../domain/runtime-evidence.js";

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
        created_at TEXT NOT NULL
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
    `);
    this.migrateTasks();
    this.migrateChangeSets();
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
      INSERT INTO projects (id, name, repository_path, git_root, branch, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        repository_path = excluded.repository_path,
        git_root = excluded.git_root,
        branch = excluded.branch
    `).run(project.id, project.name, project.repositoryPath, repository.gitRoot, repository.branch ?? null, project.createdAt);
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
             branch, created_at AS createdAt
      FROM projects WHERE id = ?
    `).get(id) as PersistedProject | undefined;
  }

  listProjects(): PersistedProject[] {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt
      FROM projects ORDER BY created_at, id
    `).all() as PersistedProject[];
  }

  getProjectByGitRoot(gitRoot: string): PersistedProject | undefined {
    return this.db.prepare(`
      SELECT id, name, repository_path AS repositoryPath, git_root AS gitRoot,
             branch, created_at AS createdAt
      FROM projects WHERE git_root = ?
    `).get(gitRoot) as PersistedProject | undefined;
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

  close(): void {
    this.db.close();
  }
}
