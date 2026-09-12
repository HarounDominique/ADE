import { mkdirSync, cpSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('dist', { recursive: true });
cpSync('src/index.html', 'dist/index.html');
cpSync('src/editor-window.html', 'dist/editor-window.html');
cpSync('src/styles.css', 'dist/styles.css');
cpSync('src/components.css', 'dist/components.css');
cpSync('src/file-icons', 'dist/file-icons', { recursive: true });
await build({
  entryPoints: ['src/main.js', 'src/editor-window.js'],
  bundle: true,
  format: 'esm',
  splitting: true,
  outdir: 'dist',
  sourcemap: false,
  assetNames: 'assets/[name]-[hash]',
  loader: { '.css': 'css', '.ttf': 'file' },
});
