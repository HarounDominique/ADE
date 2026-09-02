import type { Repository } from "../domain/project.js";

export interface GitRepositoryPort {
  inspect(directory: string): Promise<Repository>;
}
