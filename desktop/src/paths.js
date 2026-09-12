/** Paths arrive from Tauri spelled the way the platform spells them, so Windows
    sends `\`. Nothing in the shell may assume a separator: every split and every
    prefix test goes through these, which accept either. */
export const pathSegments = (value) => String(value ?? '').split(/[\\/]+/).filter(Boolean);
export const pathBaseName = (value) => pathSegments(value).at(-1) ?? '';
export const pathDirname = (value) => String(value ?? '').replace(/[\\/][^\\/]*$/, '');

export function fileExtension(filePath = '') {
  return pathBaseName(filePath).toLowerCase().split('.').at(-1) ?? '';
}

/** Two paths are the same place even when one was hand-built with `/` and the
    other is Windows' native `\` -- segmenting both before comparing is what
    makes that true, instead of a raw string `===` that only matches when
    every separator happens to agree. */
export function pathsEqual(a, b) {
  const left = pathSegments(a);
  const right = pathSegments(b);
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}
