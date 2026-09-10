/** Where the published manifest lives by default. It is a release asset of the
    project's own repository, so publishing a version and announcing it are the
    same act and there is no service to keep alive. */
export const DEFAULT_UPDATE_FEED_URL = "https://github.com/HarounDominique/ADE/releases/latest/download/latest.json";

export type ReleaseArtifact = { platform: string; arch: string; file: string; sha256: string; size?: number; url?: string };
export type ReleaseManifest = { product: string; version: string; publishedAt?: string; notes?: string; artifacts: readonly ReleaseArtifact[] };

export type UpdateCheck =
  | { status: "UNCONFIGURED" }
  | { status: "CURRENT"; currentVersion: string; latestVersion: string }
  | { status: "UPDATE_AVAILABLE"; currentVersion: string; latestVersion: string; notes?: string; publishedAt?: string; artifact: ReleaseArtifact }
  /** A newer version exists and nothing was published for this machine. Telling
      an operator to update when there is nothing they could install is an
      instruction they cannot follow, so it is a state of its own. */
  | { status: "UPDATE_NOT_BUILT_FOR_THIS_PLATFORM"; currentVersion: string; latestVersion: string; platform: string; notes?: string }
  | { status: "UNREACHABLE"; message: string };

/** Ordering two versions is the whole decision, so it is a function with a
    test rather than a string comparison: "0.10.0" is newer than "0.9.0", and a
    prerelease is older than the release it leads to. */
export function compareVersions(left: string, right: string): number {
  const [leftCore = "", leftPre = ""] = splitVersion(left);
  const [rightCore = "", rightPre = ""] = splitVersion(right);
  const leftNumbers = leftCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightNumbers = rightCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftNumbers.length, rightNumbers.length); index += 1) {
    const difference = (leftNumbers[index] ?? 0) - (rightNumbers[index] ?? 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  if (leftPre === rightPre) return 0;
  // A version with a prerelease tag precedes the same version without one.
  if (!leftPre) return 1;
  if (!rightPre) return -1;
  return leftPre > rightPre ? 1 : -1;
}

function splitVersion(version: string): [string, string] {
  const trimmed = version.trim().replace(/^v/, "");
  const [core = "", ...rest] = trimmed.split("-");
  return [core, rest.join("-")];
}

/** Assay asks whether a newer version exists and says so. It does not download
    it, replace itself, or run anything: an application that rewrites its own
    bundle behind the operator is not what this product is for. */
export async function checkForUpdate(input: {
  currentVersion: string;
  feedUrl?: string;
  platform?: string;
  arch?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<UpdateCheck> {
  const feedUrl = input.feedUrl ?? DEFAULT_UPDATE_FEED_URL;
  if (!feedUrl.trim()) return { status: "UNCONFIGURED" };
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(feedUrl, { signal: AbortSignal.timeout(input.timeoutMs ?? 8_000) });
    if (!response.ok) return { status: "UNREACHABLE", message: `The release feed answered ${response.status}` };
    const manifest = readManifest(await response.json());
    if (!manifest) return { status: "UNREACHABLE", message: "The release feed did not describe a version" };
    if (compareVersions(manifest.version, input.currentVersion) <= 0) {
      return { status: "CURRENT", currentVersion: input.currentVersion, latestVersion: manifest.version };
    }
    const platform = input.platform ?? process.platform;
    const artifact = manifest.artifacts.find((candidate) => candidate.platform === platform && candidate.arch === (input.arch ?? process.arch));
    /** Only a release this machine could actually install is an update. The
        rest is news, and it says so rather than leaving a badge that asks for
        an action nobody can take. */
    if (!artifact) {
      return {
        status: "UPDATE_NOT_BUILT_FOR_THIS_PLATFORM",
        currentVersion: input.currentVersion,
        latestVersion: manifest.version,
        platform,
        ...(manifest.notes ? { notes: manifest.notes } : {}),
      };
    }
    return {
      status: "UPDATE_AVAILABLE",
      currentVersion: input.currentVersion,
      latestVersion: manifest.version,
      ...(manifest.notes ? { notes: manifest.notes } : {}),
      ...(manifest.publishedAt ? { publishedAt: manifest.publishedAt } : {}),
      artifact,
    };
  } catch (error: unknown) {
    /** Being offline is the ordinary case, not an error to report as a
        failure of the application. */
    return { status: "UNREACHABLE", message: error instanceof Error ? error.message : String(error) };
  }
}

function readManifest(payload: unknown): ReleaseManifest | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const raw = payload as Record<string, unknown>;
  if (typeof raw.version !== "string" || !raw.version.trim()) return undefined;
  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.filter((item): item is ReleaseArtifact => Boolean(item) && typeof item === "object" && typeof (item as ReleaseArtifact).platform === "string" && typeof (item as ReleaseArtifact).arch === "string")
    : [];
  return {
    product: typeof raw.product === "string" ? raw.product : "Assay",
    version: raw.version,
    ...(typeof raw.publishedAt === "string" ? { publishedAt: raw.publishedAt } : {}),
    ...(typeof raw.notes === "string" ? { notes: raw.notes } : {}),
    artifacts,
  };
}
