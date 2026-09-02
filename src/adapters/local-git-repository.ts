import { realpath } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { Repository } from "../domain/project.js";
import type { GitRepositoryPort } from "../ports/git-repository.js";

const execFile = promisify(execFileCallback);

export class LocalGitRepository implements GitRepositoryPort {
  async inspect(directory: string): Promise<Repository> {
    const path = await realpath(directory);
    const [rootResult, branchResult] = await Promise.all([
      execFile("git", ["rev-parse", "--show-toplevel"], { cwd: path }),
      execFile("git", ["branch", "--show-current"], { cwd: path }),
    ]);
    const gitRoot = await realpath(rootResult.stdout.trim());
    const branch = branchResult.stdout.trim();
    return branch ? { path, gitRoot, branch } : { path, gitRoot };
  }
}
