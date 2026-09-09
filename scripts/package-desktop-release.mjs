import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/* Installing Assay used to mean replacing a bundle by hand. This produces the
   installable artifact instead: one command, from a version read in one place,
   ending in a manifest that says exactly what was built and with what checksum.
   It never publishes: uploading the artifact and its manifest to a release is a
   human decision, taken outside this script. */

// A file URL's pathname keeps a leading slash before a drive letter, so only
// fileURLToPath yields a path every platform can resolve.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const skipBuild = process.argv.includes('--skip-build');

if (process.platform !== 'darwin') {
  console.error('Only the macOS artifact is produced today. Windows and Linux installers are declared in SPEC-cross-platform-support and not built here.');
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

const bundle = resolve(root, `desktop/src-tauri/target/release/bundle/macos/${productName}.app`);
if (!skipBuild) {
  const built = spawnSync('npm', ['run', 'desktop:package:app'], { cwd: root, stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status ?? 1);
}
if (!existsSync(bundle)) {
  console.error(`No bundle at ${bundle}. Run without --skip-build, or build it first with npm run desktop:package:app.`);
  process.exit(1);
}

const arch = process.arch;
const releaseDirectory = resolve(root, 'release');
const staging = resolve(releaseDirectory, `${productName}-${version}-staging`);
const artifactName = `${productName}-${version}-macos-${arch}.dmg`;
const artifact = resolve(releaseDirectory, artifactName);

mkdirSync(releaseDirectory, { recursive: true });
rmSync(staging, { recursive: true, force: true });
rmSync(artifact, { force: true });
mkdirSync(staging, { recursive: true });

// The disk image carries the application beside a link to /Applications, which
// is what turns installing into a drag instead of an instruction.
cpSync(bundle, resolve(staging, `${productName}.app`), { recursive: true });
symlinkSync('/Applications', resolve(staging, 'Applications'));

// hdiutil directly, rather than Tauri's bundle_dmg.sh, which fails in this
// environment and is what left the .dmg deferred until now.
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

const bytes = readFileSync(artifact);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = {
  product: productName,
  version,
  publishedAt: new Date().toISOString(),
  notes: `https://github.com/HarounDominique/ADE/releases/tag/v${version}`,
  artifacts: [{
    platform: 'darwin',
    arch,
    file: artifactName,
    sha256,
    size: statSync(artifact).size,
    url: `https://github.com/HarounDominique/ADE/releases/download/v${version}/${artifactName}`,
  }],
};
// The same file the running application reads to learn a newer version exists,
// so the checksum a user verifies and the version the app compares against are
// the same statement.
writeFileSync(resolve(releaseDirectory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ artifact, sha256, manifest: resolve(releaseDirectory, 'latest.json'), version }, null, 2));
