import { realpath } from "node:fs/promises";
import type { Repository } from "../domain/project.js";
import type { GitRepositoryPort } from "../ports/git-repository.js";
import { executeGit } from "./git-command.js";

export class LocalGitRepository implements GitRepositoryPort {
  async inspect(directory: string): Promise<Repository> {
    const path = await realpath(directory);
    const [rootResult, branchResult] = await Promise.all([
      executeGit(["rev-parse", "--show-toplevel"], { cwd: path }),
      executeGit(["branch", "--show-current"], { cwd: path }),
    ]);
    const gitRoot = await realpath(rootResult.stdout.trim());
    const branch = branchResult.stdout.trim();
    return branch ? { path, gitRoot, branch, versionControl: "git" } : { path, gitRoot, versionControl: "git" };
  }
}
