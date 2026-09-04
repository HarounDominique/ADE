import { realpath } from "node:fs/promises";
import { Project } from "../../domain/project.js";
import type { GitRepositoryPort } from "../../ports/git-repository.js";
import { AdeStore } from "../../persistence/sqlite-store.js";

export async function registerProject(
  store: AdeStore,
  git: GitRepositoryPort,
  input: { id: string; name: string; repositoryPath: string },
): Promise<Project> {
  let repository;
  try {
    repository = await git.inspect(input.repositoryPath);
  } catch {
    const path = await realpath(input.repositoryPath);
    repository = { path, gitRoot: path, versionControl: "none" as const };
  }
  const existing = repository.versionControl === "none"
    ? store.getProjectByRepositoryPath(repository.path)
    : store.getProjectByGitRoot(repository.gitRoot!);
  if (existing) throw new Error(`Project already exists for ${repository.versionControl === "none" ? "folder" : "Git root"}: ${existing.id}`);
  const project = Project.create({ ...input, repositoryPath: repository.path });
  store.saveProject(project, repository);
  return project;
}
