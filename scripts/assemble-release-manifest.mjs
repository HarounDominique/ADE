import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { mergeManifest } from './release-manifest.mjs';

const [inputArgument = 'release-input', outputArgument = 'release'] = process.argv.slice(2);
const inputRoot = resolve(inputArgument);
const outputRoot = resolve(outputArgument);

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(inputRoot);
const manifests = files.filter((path) => basename(path) === 'latest.json');
if (manifests.length === 0) {
  throw new Error(`No platform manifests found under ${inputRoot}`);
}

let combined;
for (const manifestPath of manifests) {
  const platformManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const artifact of platformManifest.artifacts ?? []) {
    const source = files.find((path) => basename(path) === artifact.file);
    if (!source) throw new Error(`Missing release asset ${artifact.file}`);
    mkdirSync(outputRoot, { recursive: true });
    cpSync(source, join(outputRoot, artifact.file));
    combined = mergeManifest(combined, { ...platformManifest, artifact });
  }
}

if (!combined || combined.artifacts.length === 0) {
  throw new Error('Platform manifests contained no artifacts');
}
mkdirSync(outputRoot, { recursive: true });
writeFileSync(join(outputRoot, 'latest.json'), `${JSON.stringify(combined, null, 2)}\n`);
console.log(JSON.stringify({ output: outputRoot, version: combined.version, artifacts: combined.artifacts.map(({ platform, arch, file }) => `${platform}/${arch}: ${file}`) }, null, 2));
