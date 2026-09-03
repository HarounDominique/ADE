import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(root, 'desktop/sidecar-dist');
const compiler = resolve(root, 'node_modules/typescript/lib/tsc.js');
const seaNode = process.env.ADE_SEA_NODE ?? process.execPath;

rmSync(output, { recursive: true, force: true });
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync(process.execPath, [
  compiler,
  'src/desktop-sidecar.ts',
  '--outDir', output,
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--target', 'ES2022',
  '--skipLibCheck',
  '--types', 'node',
], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

writeFileSync(resolve(output, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

const bundledEntrypoint = resolve(output, 'desktop-sidecar.cjs');
const bundler = resolve(root, 'node_modules/esbuild/bin/esbuild');
const bundled = spawnSync(bundler, ['src/desktop-sidecar.ts', '--bundle', '--platform=node', '--format=cjs', '--target=node22', `--outfile=${bundledEntrypoint}`], { cwd: root, stdio: 'inherit' });
if (bundled.status !== 0) process.exit(bundled.status ?? 1);

const seaConfig = resolve('/private/tmp', `ade-sea-${process.pid}.json`);
const seaBlob = resolve('/private/tmp', `ade-sea-${process.pid}.blob`);
const seaExecutable = resolve(output, 'ade-sidecar');
writeFileSync(seaConfig, JSON.stringify({
  main: bundledEntrypoint,
  output: seaBlob,
  disableExperimentalSEAWarning: true,
}, null, 2));
const sea = spawnSync(seaNode, ['--experimental-sea-config', seaConfig], { cwd: root, stdio: 'inherit' });
if (sea.status !== 0) process.exit(sea.status ?? 1);
copyFileSync(seaNode, seaExecutable);
chmodSync(seaExecutable, 0o755);
if (process.platform === 'darwin') {
  spawnSync('codesign', ['--remove-signature', seaExecutable], { stdio: 'inherit' });
}
const postject = resolve(root, 'node_modules/.bin/postject');
const injected = spawnSync(postject, [seaExecutable, 'NODE_SEA_BLOB', seaBlob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--macho-segment-name', 'NODE_SEA'], { cwd: root, stdio: 'inherit' });
if (injected.status !== 0) process.exit(injected.status ?? 1);
if (process.platform === 'darwin') {
  const signed = spawnSync('codesign', ['--sign', '-', seaExecutable], { stdio: 'inherit' });
  if (signed.status !== 0) process.exit(signed.status ?? 1);
}
rmSync(seaConfig, { force: true });
rmSync(seaBlob, { force: true });
console.log(`Desktop sidecar executable built at ${seaExecutable}`);
