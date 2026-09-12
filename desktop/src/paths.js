/** Paths arrive from Tauri spelled the way the platform spells them, so Windows
    sends `\`. Nothing in the shell may assume a separator: every split and every
    prefix test goes through these, which accept either. */
export const pathSegments = (value) => String(value ?? '').split(/[\\/]+/).filter(Boolean);
export const pathBaseName = (value) => pathSegments(value).at(-1) ?? '';
export const pathDirname = (value) => String(value ?? '').replace(/[\\/][^\\/]*$/, '');

export function fileExtension(filePath = '') {
  return pathBaseName(filePath).toLowerCase().split('.').at(-1) ?? '';
}
