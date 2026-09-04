export function mergeActiveProject(currentProject, incomingProject = {}) {
  const merged = { ...currentProject, ...incomingProject };
  if (!merged.name) merged.name = 'Project';
  return merged;
}
