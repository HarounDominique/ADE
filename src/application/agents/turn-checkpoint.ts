import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { executeGit } from "../../adapters/git-command.js";

/** A repository that cannot hold a checkpoint says so instead of letting a
    writing turn believe it has a way back. */
export class CheckpointUnavailableError extends Error {
  readonly code = "CHECKPOINT_UNAVAILABLE";
}

export type TurnCheckpoint = {
  ref: string;
  commit: string;
  directory: string;
  files: number;
};

/** The permissions that let a turn write. Reading the repository needs no way
    back; changing it does. */
export function turnWrites(grantedPermissions: readonly string[] | undefined): boolean {
  return (grantedPermissions ?? []).some((permission) => permission === "write_code" || permission === "write_docs");
}

/** A writing turn is the one moment ADE knows the tree was still the
    operator's. Before it runs, the whole working tree -- tracked, staged and
    untracked alike -- is written as a commit object that no branch points at,
    and a ref under `refs/ade/checkpoints/` keeps it alive. Nothing about the
    operator's HEAD, index or branch moves: this is a photograph, not a commit
    in their history. */
export async function createTurnCheckpoint(
  input: { directory: string; label: string; id?: string },
): Promise<TurnCheckpoint> {
  const directory = await repositoryRoot(input.directory);
  const gitDir = (await git(["rev-parse", "--absolute-git-dir"], directory)).trim();
  const indexFile = join(gitDir, `ade-checkpoint-${input.id ?? randomUUID()}.index`);
  try {
    // A temporary index leaves the operator's staging untouched: what they had
    // staged before the turn is what they still have after it.
    await git(["add", "-A"], directory, indexFile);
    const tree = (await git(["write-tree"], directory, indexFile)).trim();
    const parent = await headCommit(directory);
    const commit = (await git([
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
      "-m",
      `ADE checkpoint: ${input.label}`,
    ], directory, indexFile, checkpointIdentity())).trim();
    const ref = `refs/ade/checkpoints/${input.id ?? commit.slice(0, 12)}`;
    // Without a ref the commit is unreachable and garbage collection is free to
    // take the way back with it.
    await git(["update-ref", ref, commit], directory);
    const files = (await git(["ls-tree", "-r", "--name-only", commit], directory)).split("\n").filter(Boolean).length;
    return { ref, commit, directory, files };
  } catch (error: unknown) {
    throw new CheckpointUnavailableError(error instanceof Error ? error.message : String(error));
  } finally {
    await rm(indexFile, { force: true }).catch(() => undefined);
  }
}

export type CheckpointRestore = {
  commit: string;
  restored: number;
  removed: readonly string[];
  /** Files the turn added that the filesystem would not let go of. */
  locked?: readonly string[];
  previous: TurnCheckpoint;
};

/** Going back is itself a change, so it starts by photographing what it is
    about to undo: an operator who restores the wrong checkpoint has the same
    way back the turn had. The working tree is then made to match the
    checkpoint exactly -- files it did not contain are deleted, the rest are
    written from it -- while HEAD, the branch and the index stay where the
    operator left them. */
export async function restoreTurnCheckpoint(
  input: { directory: string; commit: string; label?: string },
): Promise<CheckpointRestore> {
  const directory = await repositoryRoot(input.directory);
  const previous = await createTurnCheckpoint({ directory, label: input.label ?? `before restoring ${input.commit.slice(0, 12)}` });
  const gitDir = (await git(["rev-parse", "--absolute-git-dir"], directory)).trim();
  const indexFile = join(gitDir, `ade-restore-${randomUUID()}.index`);
  try {
    const checkpointFiles = new Set(splitZ(await git(["ls-tree", "-r", "-z", "--name-only", input.commit], directory)));
    const currentFiles = splitZ(await git(["ls-files", "-z", "-c", "-o", "--exclude-standard"], directory));
    const removed = currentFiles.filter((path) => !checkpointFiles.has(path));
    /** Windows refuses to delete a file another program holds open, and a
        restore that stops at the first locked file leaves the tree in a state
        that is neither the checkpoint nor what the turn produced. It removes
        what it can, and names what it could not. */
    const locked: string[] = [];
    for (const path of removed) {
      try { await rm(join(directory, path), { force: true }); }
      catch { locked.push(path); }
    }
    await git(["read-tree", input.commit], directory, indexFile);
    await git(["checkout-index", "-a", "-f"], directory, indexFile);
    return {
      commit: input.commit,
      restored: checkpointFiles.size,
      removed: removed.filter((path) => !locked.includes(path)),
      ...(locked.length ? { locked } : {}),
      previous,
    };
  } catch (error: unknown) {
    throw new CheckpointUnavailableError(error instanceof Error ? error.message : String(error));
  } finally {
    await rm(indexFile, { force: true }).catch(() => undefined);
  }
}

async function repositoryRoot(directory: string): Promise<string> {
  try {
    return (await git(["rev-parse", "--show-toplevel"], directory)).trim() || directory;
  } catch (error: unknown) {
    throw new CheckpointUnavailableError(`${directory} is not a Git repository, so a turn cannot leave a way back there`);
  }
}

/** An empty repository has no first commit to hang the checkpoint from, which
    is a shape to handle rather than a failure. */
async function headCommit(directory: string): Promise<string | undefined> {
  try {
    return (await git(["rev-parse", "--verify", "HEAD"], directory)).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** The checkpoint is ADE's, not the operator's: it is never signed with their
    identity, and a repository without one configured can still take it. */
function checkpointIdentity(): NodeJS.ProcessEnv {
  return {
    GIT_AUTHOR_NAME: "ADE",
    GIT_AUTHOR_EMAIL: "ade@localhost",
    GIT_COMMITTER_NAME: "ADE",
    GIT_COMMITTER_EMAIL: "ade@localhost",
  };
}

async function git(args: string[], cwd: string, indexFile?: string, identity?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await executeGit(args, {
    cwd,
    ...(indexFile || identity ? { env: { ...(indexFile ? { GIT_INDEX_FILE: indexFile } : {}), ...identity } } : {}),
  });
  return stdout;
}

function splitZ(output: string): string[] {
  return output.split("\0").filter(Boolean);
}
