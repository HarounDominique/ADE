/* One release, several machines. A macOS artifact is built on a Mac and a
   Windows one on a Windows box, so each run knows about exactly one of them —
   and a manifest rewritten from scratch by whoever ran last would erase the
   other platform's entry, leaving every install of it told there is nothing to
   download. The manifest is therefore merged, not replaced. */

/** Entries are keyed by the machine they are for: building the same platform
    twice replaces its entry rather than listing it twice. */
export function mergeManifest(existing, release) {
  const sameRelease = existing && existing.version === release.version;
  const kept = sameRelease
    ? (existing.artifacts ?? []).filter((artifact) => !(artifact.platform === release.artifact.platform && artifact.arch === release.artifact.arch))
    : [];
  return {
    product: release.product,
    version: release.version,
    publishedAt: release.publishedAt,
    notes: release.notes,
    // A stable order keeps two manifests for the same release comparable.
    artifacts: [...kept, release.artifact].sort((left, right) =>
      `${left.platform} ${left.arch}`.localeCompare(`${right.platform} ${right.arch}`)),
  };
}
