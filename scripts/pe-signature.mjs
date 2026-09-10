import { openSync, readSync, closeSync, ftruncateSync, writeSync } from 'node:fs';

/* A signed executable that is then modified carries a signature that no longer
   matches its bytes, and Windows treats a broken signature worse than none at
   all: SmartScreen and antivirus read tampering rather than an unsigned build.
   The sidecar is a copy of `node.exe`, which the Node project signs, and the
   SEA payload is injected straight over it — so the copy inherits a signature
   that the injection immediately invalidates.

   Authenticode lives in the certificate table, one of the PE optional header's
   data directories, and it is appended at the end of the file rather than
   mapped into memory. Removing it is therefore exact: clear the directory entry
   and drop the bytes it pointed at. What is left is honestly unsigned, which is
   what an unsigned build should look like. */

const PE_SIGNATURE = 0x0000_4550; // 'PE\0\0'
const PE32_MAGIC = 0x10b;
const PE32_PLUS_MAGIC = 0x20b;
const CERTIFICATE_DIRECTORY_INDEX = 4;
const DATA_DIRECTORY_ENTRY_SIZE = 8;

export function findCertificateTable(header) {
  if (header.length < 0x40) return null;
  if (header.readUInt16LE(0) !== 0x5a4d) return null; // 'MZ'
  const peOffset = header.readUInt32LE(0x3c);
  if (peOffset + 24 > header.length || header.readUInt32LE(peOffset) !== PE_SIGNATURE) return null;
  const optionalHeader = peOffset + 24;
  const magic = header.readUInt16LE(optionalHeader);
  // The two shapes differ only in how much room the header gives to addresses,
  // and therefore in where the data directories begin.
  const directories = optionalHeader + (magic === PE32_PLUS_MAGIC ? 112 : magic === PE32_MAGIC ? 96 : 0);
  if (directories === optionalHeader) return null;
  const entry = directories + CERTIFICATE_DIRECTORY_INDEX * DATA_DIRECTORY_ENTRY_SIZE;
  if (entry + DATA_DIRECTORY_ENTRY_SIZE > header.length) return null;
  return { entry, offset: header.readUInt32LE(entry), size: header.readUInt32LE(entry + 4) };
}

/** Returns what it did, so a build can say it rather than assume it. */
export function stripAuthenticodeSignature(path) {
  const file = openSync(path, 'r+');
  try {
    const header = Buffer.alloc(1024);
    readSync(file, header, 0, header.length, 0);
    const table = findCertificateTable(header);
    if (!table || !table.size) return { stripped: false, reason: table ? 'unsigned' : 'not a PE executable' };
    const cleared = Buffer.alloc(DATA_DIRECTORY_ENTRY_SIZE);
    writeSync(file, cleared, 0, cleared.length, table.entry);
    // The signature is appended, so what pointed at it is also the new length.
    ftruncateSync(file, table.offset);
    return { stripped: true, bytes: table.size, offset: table.offset };
  } finally {
    closeSync(file);
  }
}
