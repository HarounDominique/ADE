import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { Project } from "../src/domain/project.js";
import { LocalGitRepository } from "../src/adapters/local-git-repository.js";
import { Task } from "../src/domain/task.js";

const execFile = promisify(execFileCallback);

test("Project validates stable identity and Task can reference it", () => {
  const project = Project.create({ id: "project-1", name: "ADE", repositoryPath: "/tmp/ade" });
  const task = Task.create({ id: "task-1", intent: "Inspect", projectId: project.id, repositoryPath: project.repositoryPath });

  assert.equal(project.name, "ADE");
  assert.equal(task.projectId, "project-1");
  assert.equal(task.repositoryPath, "/tmp/ade");
  assert.throws(() => Project.create({ id: "", name: "ADE", repositoryPath: "/tmp/ade" }), /id cannot be empty/);
  assert.throws(() => Project.create({ id: "p", name: "ADE", repositoryPath: "relative" }), /must be absolute/);
});

test("LocalGitRepository returns canonical root and current branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-project-"));
  await execFile("git", ["init", "-q", root]);
  const nested = join(root, "nested");
  await mkdir(nested);

  const repository = await new LocalGitRepository().inspect(nested);
  assert.equal(repository.path, await realpath(nested));
  assert.equal(repository.gitRoot, await realpath(root));
  assert.equal(typeof repository.branch, "string");
});
