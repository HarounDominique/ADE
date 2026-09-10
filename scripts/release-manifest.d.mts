export type ReleaseArtifact = { platform: string; arch: string; file: string; sha256: string; size?: number; url?: string };
export type ReleaseManifest = { product: string; version: string; publishedAt?: string; notes?: string; artifacts: ReleaseArtifact[] };

export function mergeManifest(
  existing: ReleaseManifest | undefined,
  release: { product: string; version: string; publishedAt?: string; notes?: string; artifact: ReleaseArtifact },
): ReleaseManifest;
