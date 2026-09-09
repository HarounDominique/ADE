/**
 * Temporary shell boundary. The Tauri command will replace this fixture with
 * a serialized ProjectSnapshot without changing the navigation or view model.
 */
export const projectSnapshot = {
  project: {
    id: 'ade',
    name: 'ADE',
    description: 'Agentic Development Environment',
    /** A fixture must not carry a path that looks real: this one reached a
        process spawn as its working directory and failed there. */
    repositoryPath: '',
    branch: 'master',
    workingTree: 'clean',
  },
  metrics: {
    activeTasks: 2,
    inReview: 1,
    services: { active: 0, declared: 0 },
    lastShip: null,
  },
  sync: { state: 'ready', label: 'Synced just now' },
};
