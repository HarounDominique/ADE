/**
 * Temporary shell boundary. The Tauri command will replace this fixture with
 * a serialized ProjectSnapshot without changing the navigation or view model.
 */
export const projectSnapshot = {
  project: {
    id: '',
    name: '',
    description: '',
    /** A fixture must not carry anything that looks real: a path here reached a
        process spawn as its working directory and failed there, and a name here
        made a fresh install look like it had a Project open when it had none. */
    repositoryPath: '',
    branch: null,
    workingTree: 'unknown',
  },
  metrics: {
    activeTasks: 0,
    inReview: 0,
    services: { active: 0, declared: 0 },
    lastShip: null,
  },
  sync: { state: 'stale', label: 'Loading…' },
};
