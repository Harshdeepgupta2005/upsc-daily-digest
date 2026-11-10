// Pure settings migration for the desktop shell. Keeping it free of Electron
// imports lets the self-test exercise it directly.

// Tuning keys that later versions no longer read. Leaving them behind makes the
// settings file look customised when it is only stale.
export const RETIRED_CONFIG_KEYS = ["maxItemsPerDay", "maxPerTheme", "maxPerTopic"];

// Defaults that changed because the product changed. A stored value equal to
// the old default was never a deliberate choice, so adopt the new one.
export const SUPERSEDED_DEFAULTS = { minRelevance: 20 };

export function migrateConfig(current, template) {
  const config = { ...current };
  let changed = false;

  for (const key of RETIRED_CONFIG_KEYS) {
    if (key in config) {
      delete config[key];
      changed = true;
    }
  }

  for (const [key, previous] of Object.entries(SUPERSEDED_DEFAULTS)) {
    if (config[key] === previous && template[key] !== undefined) {
      config[key] = template[key];
      changed = true;
    }
  }

  for (const [key, value] of Object.entries(template)) {
    if (!(key in config)) {
      config[key] = value;
      changed = true;
    }
  }

  if (template.scheduler) {
    const scheduler = { ...template.scheduler, ...(config.scheduler || {}) };
    if (JSON.stringify(scheduler) !== JSON.stringify(config.scheduler)) changed = true;
    config.scheduler = scheduler;
  }

  return { config, changed };
}
