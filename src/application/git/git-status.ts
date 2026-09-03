import { captureGitChanges } from "../../adapters/git-changes.js";
import { LocalGitRepository } from "../../adapters/local-git-repository.js";

export async function getGitStatus(directory: string) {
  const [repository, changes] = await Promise.all([new LocalGitRepository().inspect(directory), captureGitChanges(directory)]);
  return { repository, changes };
}
