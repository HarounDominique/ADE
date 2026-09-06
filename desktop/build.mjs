import { mkdirSync, cpSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('dist', { recursive: true });
cpSync('src/index.html', 'dist/index.html');
cpSync('src/styles.css', 'dist/styles.css');
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  splitting: true,
  outdir: 'dist',
  sourcemap: false,
  assetNames: 'assets/[name]-[hash]',
  loader: { '.css': 'css', '.ttf': 'file' },
});
