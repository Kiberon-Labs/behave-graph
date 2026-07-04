import type { SettingDescriptor } from '@/store/settingsSchema';

/**
 * Setting keys owned by the autosave plugin. Namespaced (`autosave.*`) so they
 * never collide with the built-in flat setting keys.
 */
export const AUTOSAVE_ENABLED = 'autosave.enabled';
export const AUTOSAVE_INTERVAL_SECONDS = 'autosave.intervalSeconds';
export const AUTOSAVE_MAX_COPIES = 'autosave.maxCopies';

/** Shipped defaults, also used by the controller when a value is missing. */
export const AUTOSAVE_DEFAULTS = {
  enabled: false,
  intervalSeconds: 60,
  maxCopies: 20
} as const;

/** Lower bound on the timer so a typo can't spin the loop every frame. */
export const MIN_INTERVAL_SECONDS = 5;

/**
 * The Settings-panel rows this plugin contributes. Registered via
 * `system.registerSettings(...)`, which also seeds each default into the value
 * store, so `system.getSetting(AUTOSAVE_*)` is populated the moment the plugin
 * loads.
 */
export const AUTOSAVE_SETTINGS: SettingDescriptor[] = [
  {
    key: AUTOSAVE_ENABLED,
    section: 'Autosave',
    order: 0,
    type: 'boolean',
    default: AUTOSAVE_DEFAULTS.enabled,
    title: 'Enable local backups',
    description:
      'Periodically snapshot open graphs into local storage so a crash or a bad edit is recoverable. Purely client-side; nothing leaves the browser.'
  },
  {
    key: AUTOSAVE_INTERVAL_SECONDS,
    section: 'Autosave',
    order: 1,
    type: 'number',
    default: AUTOSAVE_DEFAULTS.intervalSeconds,
    min: MIN_INTERVAL_SECONDS,
    step: 5,
    title: 'Backup frequency (seconds)',
    description:
      'How often a snapshot is taken. A copy is only written when the graph has actually changed and is in a consistent state.',
    when: (values) => values[AUTOSAVE_ENABLED] === true
  },
  {
    key: AUTOSAVE_MAX_COPIES,
    section: 'Autosave',
    order: 2,
    type: 'number',
    default: AUTOSAVE_DEFAULTS.maxCopies,
    min: 1,
    max: 200,
    step: 1,
    title: 'Copies to keep per graph',
    description:
      'The oldest snapshots are discarded once a graph has this many. Higher values use more local storage.',
    when: (values) => values[AUTOSAVE_ENABLED] === true
  }
];
