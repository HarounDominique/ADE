import { AdeStore } from "../../persistence/sqlite-store.js";

/** The operator's own preferences, as opposed to a Project's policy or a
    window's layout. They live in ADE's database rather than in the webview's
    storage for two reasons: they survive a reinstall, and the sidecar can read
    them -- a preference the backend cannot see is a preference no capability
    can depend on, which is why the remote notice, a spend limit and a private
    release feed were all stuck behind "ADE has no user settings". */
export type UserSettings = {
  /** A short tone when a turn ends. Owned by the operator, not the Project. */
  turnChime: boolean;
  /** Which model a new conversation starts on, per provider. Never rewrites a
      conversation that already chose one. */
  defaultModels: Record<string, string>;
  /** Where the app asks whether a newer version has been published. Empty means
      this install asks nobody. */
  updateFeedUrl?: string;
  /** Whether ADE conducts work through the adaptive workflow's phases. On by
      default: a differentiator that arrives switched off is one nobody sees.
      Off, Tasks, gates, evidence and review all still exist -- what stops is the
      conducting, not the governance. A Project can override this either way
      (ADR-0056). */
  developmentWorkflow: boolean;
};

export const defaultSettings: UserSettings = { turnChime: true, defaultModels: {}, developmentWorkflow: true };

export function readSettings(store: AdeStore): UserSettings {
  return normalizeSettings(store.getSetting("user") as Partial<UserSettings> | undefined);
}

/** A write states only what changes; everything unmentioned keeps its value, so
    two surfaces editing different preferences cannot erase each other's. */
export function writeSettings(store: AdeStore, patch: Partial<UserSettings>): UserSettings {
  const current = readSettings(store);
  const next = normalizeSettings({
    ...current,
    ...patch,
    ...(patch.defaultModels ? { defaultModels: { ...current.defaultModels, ...patch.defaultModels } } : {}),
  });
  store.setSetting("user", next);
  return next;
}

function normalizeSettings(value: Partial<UserSettings> | undefined): UserSettings {
  const models = value?.defaultModels && typeof value.defaultModels === "object" ? value.defaultModels : {};
  return {
    turnChime: value?.turnChime !== false,
    developmentWorkflow: value?.developmentWorkflow !== false,
    /** A default the operator cleared is removed rather than stored as an empty
        string that would later read as a model named "". */
    defaultModels: Object.fromEntries(Object.entries(models).filter(([provider, model]) => provider && typeof model === "string" && model.trim())),
    ...(typeof value?.updateFeedUrl === "string" ? { updateFeedUrl: value.updateFeedUrl.trim() } : {}),
  };
}
