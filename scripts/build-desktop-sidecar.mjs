import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(root, 'desktop/sidecar-dist');
const compiler = resolve(root, 'node_modules/typescript/lib/tsc.js');

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
console.log(`Desktop sidecar built at ${output}`);
