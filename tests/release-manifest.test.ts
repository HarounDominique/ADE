import test from "node:test";
import assert from "node:assert/strict";
import { mergeManifest } from "../scripts/release-manifest.mjs";

const darwin = { platform: "darwin", arch: "arm64", file: "Assay-0.2.0-macos-arm64.dmg", sha256: "machash" };
const windows = { platform: "win32", arch: "x64", file: "Assay-0.2.0-windows-x64-setup.exe", sha256: "winhash" };

test("one release holds the artifact each machine could build", () => {
  const afterMac = mergeManifest(undefined, { product: "Assay", version: "0.2.0", artifact: darwin });
  assert.deepEqual(afterMac.artifacts, [darwin]);

  // The Windows box runs the same command later and must not erase the Mac's
  // work: an install of the other platform would then be told there is nothing
  // to download, which is exactly the bug being closed.
  const afterBoth = mergeManifest(afterMac, { product: "Assay", version: "0.2.0", artifact: windows });
  assert.deepEqual(afterBoth.artifacts.map((entry) => entry.platform), ["darwin", "win32"]);
});

test("building the same platform twice replaces its entry rather than listing it twice", () => {
  const first = mergeManifest(undefined, { product: "Assay", version: "0.2.0", artifact: windows });
  const rebuilt = { ...windows, sha256: "rebuilt" };
  const second = mergeManifest(first, { product: "Assay", version: "0.2.0", artifact: rebuilt });

  assert.equal(second.artifacts.length, 1);
  assert.equal(second.artifacts[0]?.sha256, "rebuilt");
});

test("a new version starts a new manifest instead of inheriting old downloads", () => {
  const previous = mergeManifest(undefined, { product: "Assay", version: "0.2.0", artifact: darwin });

  const next = mergeManifest(previous, { product: "Assay", version: "0.3.0", artifact: windows });

  // Carrying 0.2.0's macOS artifact into 0.3.0 would offer a download that is
  // not the version the manifest announces.
  assert.deepEqual(next.artifacts, [windows]);
  assert.equal(next.version, "0.3.0");
});
