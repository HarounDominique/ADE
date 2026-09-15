/** Keep dropped paths as references. The shell never reads their contents here. */
export function quoteDroppedPath(path, platform = 'posix') {
  const value = String(path ?? '');
  if (platform === 'windows') return `'${value.replaceAll("'", "''")}'`;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function droppedPathPlatform(userAgent = '') {
  return /windows/i.test(userAgent) ? 'windows' : 'posix';
}

export function formatDroppedPaths(paths, platform = 'posix') {
  return [...new Set(paths.map((path) => String(path ?? '').trim()).filter(Boolean))]
    .map((path) => quoteDroppedPath(path, platform))
    .join(' ');
}
