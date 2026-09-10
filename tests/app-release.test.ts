import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_UPDATE_FEED_URL, checkForUpdate, compareVersions } from "../src/application/release/update-check.js";

const releaseScript = readFileSync(new URL("../scripts/package-desktop-release.mjs", import.meta.url), "utf8");
const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
const tauriConfig = JSON.parse(readFileSync(new URL("../desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8")) as { version: string; productName: string };

function feed(manifest: unknown, status = 200): typeof fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status, json: async () => manifest })) as unknown as typeof fetch;
}

test("versions order by number, not by string", () => {
  assert.equal(compareVersions("0.10.0", "0.9.0"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("v1.2.0", "1.2.0"), 0);
  assert.equal(compareVersions("0.1.0", "0.1.1"), -1);
  // A prerelease precedes the release it leads to.
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.1"), 1);
});

test("a newer published version is reported with the artifact for this machine", async () => {
  const update = await checkForUpdate({
    currentVersion: "0.1.0",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: feed({
      product: "Assay",
      version: "0.2.0",
      notes: "https://example.test/releases/v0.2.0",
      artifacts: [
        { platform: "darwin", arch: "x64", file: "Assay-0.2.0-macos-x64.dmg", sha256: "x64hash" },
        { platform: "darwin", arch: "arm64", file: "Assay-0.2.0-macos-arm64.dmg", sha256: "armhash" },
      ],
    }),
  });

  assert.equal(update.status, "UPDATE_AVAILABLE");
  assert.equal(update.status === "UPDATE_AVAILABLE" && update.latestVersion, "0.2.0");
  assert.equal(update.status === "UPDATE_AVAILABLE" && update.artifact?.file, "Assay-0.2.0-macos-arm64.dmg");
});

test("the running version being the published one is not an update", async () => {
  const same = await checkForUpdate({ currentVersion: "0.2.0", fetchImpl: feed({ version: "0.2.0", artifacts: [] }) });
  assert.equal(same.status, "CURRENT");
  // A feed left behind by a rollback does not push the operator backwards.
  const older = await checkForUpdate({ currentVersion: "0.3.0", fetchImpl: feed({ version: "0.2.0", artifacts: [] }) });
  assert.equal(older.status, "CURRENT");
});

test("a release nobody built for this machine is news, not an update", async () => {
  const update = await checkForUpdate({
    currentVersion: "0.1.0",
    platform: "win32",
    arch: "x64",
    fetchImpl: feed({ version: "0.2.0", notes: "https://example.test/v0.2.0", artifacts: [{ platform: "darwin", arch: "arm64", file: "Assay-0.2.0-macos-arm64.dmg", sha256: "armhash" }] }),
  });

  // Telling an operator to update when there is nothing they could install is
  // an instruction they cannot follow.
  assert.equal(update.status, "UPDATE_NOT_BUILT_FOR_THIS_PLATFORM");
  assert.equal(update.status === "UPDATE_NOT_BUILT_FOR_THIS_PLATFORM" && update.platform, "win32");
  assert.equal(update.status === "UPDATE_NOT_BUILT_FOR_THIS_PLATFORM" && update.latestVersion, "0.2.0");
  // An update is only an update when it carries something installable here.
  const installable = await checkForUpdate({
    currentVersion: "0.1.0",
    platform: "win32",
    arch: "x64",
    fetchImpl: feed({ version: "0.2.0", artifacts: [{ platform: "win32", arch: "x64", file: "Assay-0.2.0-setup.exe", sha256: "winhash" }] }),
  });
  assert.equal(installable.status, "UPDATE_AVAILABLE");
  assert.equal(installable.status === "UPDATE_AVAILABLE" && installable.artifact.file, "Assay-0.2.0-setup.exe");
});

test("being offline or unpublished is said plainly, not as a failure of the app", async () => {
  const missing = await checkForUpdate({ currentVersion: "0.1.0", fetchImpl: feed({}, 404) });
  assert.equal(missing.status, "UNREACHABLE");

  const offline = await checkForUpdate({
    currentVersion: "0.1.0",
    fetchImpl: (async () => { throw new Error("getaddrinfo ENOTFOUND github.com"); }) as unknown as typeof fetch,
  });
  assert.equal(offline.status, "UNREACHABLE");
  assert.equal(offline.status === "UNREACHABLE" && offline.message.includes("ENOTFOUND"), true);

  // A feed that answers with something that is not a manifest is unreachable
  // rather than an update to an undefined version.
  const nonsense = await checkForUpdate({ currentVersion: "0.1.0", fetchImpl: feed({ hello: "world" }) });
  assert.equal(nonsense.status, "UNREACHABLE");

  // An install pointed at no feed at all asks nobody.
  const unconfigured = await checkForUpdate({ currentVersion: "0.1.0", feedUrl: "" });
  assert.equal(unconfigured.status, "UNCONFIGURED");
});

test("the installable artifact is produced by one command from one version", () => {
  assert.equal(rootPackage.scripts["desktop:release"], "node scripts/package-desktop-release.mjs");
  // The version is read from the same file the app is built from; restating it
  // in the artifact name or the manifest is how the two drift apart.
  assert.match(releaseScript, /const \{ version, productName \} = tauriConfig;/);
  assert.match(releaseScript, /\$\{productName\}-\$\{version\}-macos-\$\{arch\}\.dmg/);
  // A disk image with a link to /Applications: installing is a drag, not an
  // instruction to replace a bundle by hand.
  assert.match(releaseScript, /symlinkSync\('\/Applications'/);
  assert.match(releaseScript, /'hdiutil'/);
  // The manifest the operator verifies is the one the app reads.
  assert.match(releaseScript, /createHash\('sha256'\)/);
  assert.match(releaseScript, /writeFileSync\(resolve\(releaseDirectory, 'latest\.json'\)/);
  assert.match(DEFAULT_UPDATE_FEED_URL, /releases\/latest\/download\/latest\.json$/);
  // Nothing is published by the script: uploading is a human decision.
  assert.doesNotMatch(releaseScript, /gh release|git push/);
  assert.equal(tauriConfig.productName, "Assay");
  assert.match(tauriConfig.version, /^\d+\.\d+\.\d+/);
});
