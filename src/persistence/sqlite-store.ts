import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ChangeSet } from "../domain/change-set.js";
import type { Task } from "../domain/task.js";
import type { Review } from "../domain/review.js";

export type PersistedTask = {
  id: string;
  intent: string;
  status: string;
  events: string;
};

export type PersistedChangeSet = {
  id: string;
  taskId: string;
  sessionId: string;
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
        events_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS change_sets (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        session_id TEXT NOT NULL,
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
    `);
  }

  saveTask(task: Task): void {
    this.db.prepare(`
      INSERT INTO tasks (id, intent, status, events_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        intent = excluded.intent,
        status = excluded.status,
        events_json = excluded.events_json
    `).run(task.id, task.intent, task.currentStatus, JSON.stringify(task.history()));
  }

  saveChangeSet(changeSet: ChangeSet): void {
    this.db.prepare(`
      INSERT INTO change_sets (
        id, task_id, session_id, captured_at, runtime_diff_json,
        git_status, git_patch, untracked_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      changeSet.id,
      changeSet.taskId,
      changeSet.sessionId,
      changeSet.capturedAt,
      JSON.stringify(changeSet.runtimeDiff),
      changeSet.git.status,
      changeSet.git.patch,
      JSON.stringify(changeSet.git.untracked),
    );
  }

  getTask(id: string): PersistedTask | undefined {
    return this.db.prepare("SELECT id, intent, status, events_json AS events FROM tasks WHERE id = ?").get(id) as PersistedTask | undefined;
  }

  getChangeSet(id: string): PersistedChangeSet | undefined {
    return this.db.prepare(`
      SELECT id, task_id AS taskId, session_id AS sessionId, captured_at AS capturedAt,
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

  close(): void {
    this.db.close();
  }
}
