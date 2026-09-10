import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const windows = process.platform === 'win32';
// A file URL's pathname keeps a leading slash before the drive letter, so only
// fileURLToPath yields a path Windows can actually resolve.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'desktop/sidecar-dist');
const compiler = resolve(root, 'node_modules/typescript/lib/tsc.js');
const seaNode = process.env.ADE_SEA_NODE ?? process.execPath;
// npm ships .cmd shims on Windows, and Node refuses to spawn those without a shell.
const binary = (name) => resolve(root, `node_modules/.bin/${name}${windows ? '.cmd' : ''}`);
const runBinary = (name, args) => spawnSync(binary(name), args, { cwd: root, stdio: 'inherit', shell: windows });

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
const bundled = runBinary('esbuild', ['src/desktop-sidecar.ts', '--bundle', '--platform=node', '--format=cjs', '--target=node22', `--outfile=${bundledEntrypoint}`]);
if (bundled.status !== 0) process.exit(bundled.status ?? 1);

const seaConfig = resolve(tmpdir(), `ade-sea-${process.pid}.json`);
const seaBlob = resolve(tmpdir(), `ade-sea-${process.pid}.blob`);
const seaExecutable = resolve(output, `ade-sidecar${windows ? '.exe' : ''}`);
writeFileSync(seaConfig, JSON.stringify({
  main: bundledEntrypoint,
  output: seaBlob,
  disableExperimentalSEAWarning: true,
}, null, 2));
const sea = spawnSync(seaNode, ['--experimental-sea-config', seaConfig], { cwd: root, stdio: 'inherit' });
if (sea.status !== 0) process.exit(sea.status ?? 1);
/* The single-file executable is a copy of `node.exe` with a payload injected,
   so it inherits Node's PE subsystem, which is `console`. Windows therefore
   gives it a console window of its own unless whoever launches it says
   otherwise, and the shell launches it with CREATE_NO_WINDOW for exactly that
   reason (`without_a_console` in desktop/src-tauri/src/lib.rs). Repatching the
   subsystem here would be the wrong fix: the sidecar still speaks over stdio. */
copyFileSync(seaNode, seaExecutable);
chmodSync(seaExecutable, 0o755);
if (process.platform === 'darwin') {
  spawnSync('codesign', ['--remove-signature', seaExecutable], { stdio: 'inherit' });
}
const injected = runBinary('postject', [
  seaExecutable,
  'NODE_SEA_BLOB',
  seaBlob,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
]);
if (injected.status !== 0) {
  // Some Node distributions omit the SEA fuse. Keep a portable launcher whose
  // runtime can be selected explicitly, with well-known and PATH fallbacks.
  if (windows) {
    writeFileSync(seaExecutable.replace(/\.exe$/, '.cmd'), '@echo off\r\nsetlocal\r\nset "NODE_BIN=%ADE_SIDECAR_NODE%"\r\nif "%NODE_BIN%"=="" set "NODE_BIN=node"\r\n"%NODE_BIN%" "%~dp0desktop-sidecar.cjs" %*\r\n');
    rmSync(seaExecutable, { force: true });
  } else {
    writeFileSync(seaExecutable, '#!/bin/sh\nDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nNODE_BIN="${ADE_SIDECAR_NODE:-/opt/homebrew/opt/node@24/bin/node}"\nif [ ! -x "$NODE_BIN" ]; then NODE_BIN="$(command -v node)"; fi\nexec "$NODE_BIN" "$DIR/desktop-sidecar.cjs" "$@"\n');
    chmodSync(seaExecutable, 0o755);
  }
} else if (process.platform === 'darwin') {
  const signed = spawnSync('codesign', ['--sign', '-', seaExecutable], { stdio: 'inherit' });
  if (signed.status !== 0) process.exit(signed.status ?? 1);
}
rmSync(seaConfig, { force: true });
rmSync(seaBlob, { force: true });
const publishedExecutable = windows && !existsSync(seaExecutable) ? seaExecutable.replace(/\.exe$/, '.cmd') : seaExecutable;
console.log(`Desktop sidecar executable built at ${publishedExecutable}`);
