/** The build scripts are plain modules by design — they run under node with no
    compile step — so the one that tests import declares its shape rather than
    being dragged into the TypeScript build. */
export type CertificateTable = { entry: number; offset: number; size: number };

export function findCertificateTable(header: Buffer): CertificateTable | null;

export function stripAuthenticodeSignature(path: string):
  | { stripped: true; bytes: number; offset: number }
  | { stripped: false; reason: string };
