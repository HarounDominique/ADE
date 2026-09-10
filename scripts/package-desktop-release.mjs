import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mergeManifest } from './release-manifest.mjs';

/* Installing Assay used to mean replacing a bundle by hand. This produces the
   installable artifact instead: one command, from a version read in one place,
   ending in a manifest that says exactly what was built and with what checksum.

   It builds for the machine it runs on, because that is the only machine whose
   installer it can produce, and it merges its result into the manifest instead
   of rewriting it — a release has one artifact per platform, each made
   somewhere else, and whoever ran last must not erase the others.

   It never publishes: uploading the artifacts and the manifest to a release is
   a human decision, taken outside this script. */

// A file URL's pathname keeps a leading slash before a drive letter, so only
// fileURLToPath yields a path every platform can resolve.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const skipBuild = process.argv.includes('--skip-build');

if (!['darwin', 'win32', 'linux'].includes(process.platform)) {
  console.error(`No installer is produced for ${process.platform}.`);
  process.exit(1);
}

const tauriConfig = JSON.parse(readFileSync(resolve(root, 'desktop/src-tauri/tauri.conf.json'), 'utf8'));
// One place holds the version. Restating it in the artifact name or the
// manifest is how the two silently drift apart.
const { version, productName } = tauriConfig;
if (!version || !productName) {
  console.error('desktop/src-tauri/tauri.conf.json must declare productName and version');
  process.exit(1);
}

const arch = process.arch;
const releaseDirectory = resolve(root, 'release');
mkdirSync(releaseDirectory, { recursive: true });

function build(script) {
  if (skipBuild) return;
  // npm is a .cmd shim on Windows, which Node cannot spawn without a shell.
  const built = spawnSync('npm', ['run', script], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

/** macOS: the application beside a link to /Applications, which is what turns
    installing into a drag rather than an instruction. `hdiutil` directly,
    rather than Tauri's bundle_dmg.sh, which fails in this environment and is
    what left the .dmg deferred for so long. */
function macosArtifact() {
  const bundle = resolve(root, `desktop/src-tauri/target/release/bundle/macos/${productName}.app`);
  build('desktop:package:app');
  if (!existsSync(bundle)) {
    console.error(`No bundle at ${bundle}. Run without --skip-build, or build it first with npm run desktop:package:app.`);
    process.exit(1);
  }
  const staging = resolve(releaseDirectory, `${productName}-${version}-staging`);
  const name = `${productName}-${version}-macos-${arch}.dmg`;
  const artifact = resolve(releaseDirectory, name);
  rmSync(staging, { recursive: true, force: true });
  rmSync(artifact, { force: true });
  mkdirSync(staging, { recursive: true });
  cpSync(bundle, resolve(staging, `${productName}.app`), { recursive: true });
  symlinkSync('/Applications', resolve(staging, 'Applications'));
  const image = spawnSync('hdiutil', [
    'create',
    '-volname', `${productName} ${version}`,
    '-srcfolder', staging,
    '-fs', 'HFS+',
    '-format', 'UDZO',
    '-ov',
    artifact,
  ], { cwd: root, stdio: 'inherit' });
  rmSync(staging, { recursive: true, force: true });
  if (image.status !== 0) process.exit(image.status ?? 1);
  return { name, artifact };
}

/** Windows: Tauri's own bundler makes the installer, so this takes what it
    produced rather than naming it — the file carries the product name and
    version, and guessing that spelling is how a rename silently stops the
    release finding anything. NSIS is preferred over MSI because it is what
    Tauri builds by default and what an operator expects to double-click. */
function windowsArtifact() {
  build('desktop:build');
  const bundles = resolve(root, 'desktop/src-tauri/target/release/bundle');
  const installer = ['nsis', 'msi']
    .map((kind) => ({ kind, directory: resolve(bundles, kind) }))
    .filter(({ directory }) => existsSync(directory))
    .flatMap(({ directory }) => readdirSync(directory)
      .filter((file) => file.endsWith('.exe') || file.endsWith('.msi'))
      .map((file) => resolve(directory, file)))[0];
  if (!installer) {
    console.error(`No installer under ${bundles}. Run without --skip-build, or build it first with npm run desktop:build.`);
    process.exit(1);
  }
  const name = `${productName}-${version}-windows-${arch}${installer.endsWith('.msi') ? '.msi' : '-setup.exe'}`;
  const artifact = resolve(releaseDirectory, name);
  rmSync(artifact, { force: true });
  copyFileSync(installer, artifact);
  return { name, artifact };
}

/** Ubuntu: publish the native Debian package first. It is the format that
    integrates with the target distribution's package manager; AppImage can be
    added later as a broad fallback without changing the release contract. */
function linuxArtifact() {
  build('desktop:build');
  const bundles = resolve(root, 'desktop/src-tauri/target/release/bundle/deb');
  const installer = existsSync(bundles)
    ? readdirSync(bundles).filter((file) => file.endsWith('.deb')).map((file) => resolve(bundles, file))[0]
    : undefined;
  if (!installer) {
    console.error(`No Debian package under ${bundles}. Run without --skip-build, or build it first with npm run desktop:build.`);
    process.exit(1);
  }
  const name = `${productName}-${version}-ubuntu-${arch}.deb`;
  const artifact = resolve(releaseDirectory, name);
  rmSync(artifact, { force: true });
  copyFileSync(installer, artifact);
  return { name, artifact };
}

const { name, artifact } = process.platform === 'darwin'
  ? macosArtifact()
  : process.platform === 'win32'
    ? windowsArtifact()
    : linuxArtifact();
const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
const manifestPath = resolve(releaseDirectory, 'latest.json');
const existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : undefined;
const manifest = mergeManifest(existing, {
  product: productName,
  version,
  publishedAt: new Date().toISOString(),
  notes: `https://github.com/HarounDominique/ADE/releases/tag/v${version}`,
  artifact: {
    platform: process.platform,
    arch,
    file: name,
    sha256,
    size: statSync(artifact).size,
    url: `https://github.com/HarounDominique/ADE/releases/download/v${version}/${name}`,
  },
});
// The same file the running application reads to learn a newer version exists,
// so the checksum a user verifies and the version the app compares against are
// the same statement.
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ artifact, sha256, manifest: manifestPath, version, platforms: manifest.artifacts.map((entry) => `${entry.platform}/${entry.arch}`) }, null, 2));
