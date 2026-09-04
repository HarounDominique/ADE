export type Repository = {
  path: string;
  gitRoot?: string;
  branch?: string;
  versionControl?: "git" | "none";
};

export type ProjectInput = {
  id: string;
  name: string;
  repositoryPath: string;
  createdAt?: string;
};

export class Project {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly repositoryPath: string,
    readonly createdAt: string,
  ) {}

  static create(input: ProjectInput): Project {
    if (!input.id.trim()) throw new Error("Project id cannot be empty");
    if (!input.name.trim()) throw new Error("Project name cannot be empty");
    if (!input.repositoryPath.trim()) throw new Error("Project repository path cannot be empty");
    if (!input.repositoryPath.startsWith("/")) {
      throw new Error("Project repository path must be absolute");
    }
    return new Project(
      input.id,
      input.name,
      input.repositoryPath,
      input.createdAt ?? new Date().toISOString(),
    );
  }
}
