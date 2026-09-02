import { Project } from "../../domain/project.js";
import type { GitRepositoryPort } from "../../ports/git-repository.js";
import { AdeStore } from "../../persistence/sqlite-store.js";

export async function registerProject(
  store: AdeStore,
  git: GitRepositoryPort,
  input: { id: string; name: string; repositoryPath: string },
): Promise<Project> {
  const repository = await git.inspect(input.repositoryPath);
  const existing = store.getProjectByGitRoot(repository.gitRoot);
  if (existing) throw new Error(`Project already exists for Git root: ${existing.id}`);
  const project = Project.create({ ...input, repositoryPath: repository.path });
  store.saveProject(project, repository);
  return project;
}
