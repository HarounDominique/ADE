import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCertificateTable, stripAuthenticodeSignature } from "../scripts/pe-signature.mjs";

/** A PE header is a fixed shape, so a fixture can be exactly that shape without
    being an executable: what is under test is the arithmetic that finds the
    certificate table, not Windows' loader. */
function portableExecutable({ signatureBytes = 0, plus = true } = {}) {
  const headerSize = 1024;
  const body = Buffer.alloc(headerSize, 0);
  body.write("MZ", 0, "ascii");
  const peOffset = 0x80;
  body.writeUInt32LE(peOffset, 0x3c);
  body.writeUInt32LE(0x0000_4550, peOffset);
  const optionalHeader = peOffset + 24;
  body.writeUInt16LE(plus ? 0x20b : 0x10b, optionalHeader);
  const directories = optionalHeader + (plus ? 112 : 96);
  const entry = directories + 4 * 8;
  if (signatureBytes) {
    body.writeUInt32LE(headerSize, entry);
    body.writeUInt32LE(signatureBytes, entry + 4);
  }
  return { file: Buffer.concat([body, Buffer.alloc(signatureBytes, 0xab)]), entry, headerSize };
}

test("the certificate table is found in both shapes of PE header", () => {
  for (const plus of [true, false]) {
    const { file, entry } = portableExecutable({ signatureBytes: 320, plus });
    const table = findCertificateTable(file);
    assert.equal(table?.entry, entry);
    assert.equal(table?.size, 320);
  }
  // Anything that is not a PE executable is left alone rather than truncated.
  assert.equal(findCertificateTable(Buffer.alloc(1024)), null);
});

test("an inherited signature is removed, not left broken", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-pe-"));
  const path = join(directory, "tool.exe");
  const { file, headerSize } = portableExecutable({ signatureBytes: 512 });
  await writeFile(path, file);

  const removed = stripAuthenticodeSignature(path);

  // Windows reads a signature that no longer matches the bytes as tampering,
  // which is worse than a build that was never signed.
  assert.equal(removed.stripped, true);
  assert.equal(removed.bytes, 512);
  const stripped = await readFile(path);
  assert.equal(stripped.length, headerSize, "the appended signature is dropped with its pointer");
  assert.equal(findCertificateTable(stripped)?.size, 0);

  // Doing it twice is not an error: an unsigned file simply has nothing to give.
  assert.equal(stripAuthenticodeSignature(path).stripped, false);
});
