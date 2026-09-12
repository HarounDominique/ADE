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

/** A Project's stored Git state is set once, at registration. A mutation
    like `git init` only touches the filesystem, so without this the stored
    row keeps answering "none" forever and every later read (project list,
    project snapshot) re-offers initializing Git that already happened. */
export async function refreshProjectRepositoryState(
  store: AdeStore,
  git: GitRepositoryPort,
  repositoryPath: string,
): Promise<void> {
  // The stored row keys on the same canonicalized path registerProject wrote
  // -- a caller passing the pre-symlink-resolution path (a temp dir alias,
  // say) would otherwise silently miss the lookup.
  const canonicalPath = await realpath(repositoryPath).catch(() => repositoryPath);
  const existing = store.getProjectByRepositoryPath(canonicalPath);
  if (!existing) return;
  const repository = await git.inspect(canonicalPath).catch(() => ({ path: canonicalPath, versionControl: "none" as const }));
  store.updateProjectRepository(existing.id, repository);
}
