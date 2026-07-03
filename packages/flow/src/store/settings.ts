import { create } from 'zustand';

export const EDGE_TYPE = {
  bezier: 'Bezier',
  smoothStep: 'Smooth step',
  straight: 'Straight',
  simpleBezier: 'Simple Bezier'
} as const;

export type EdgeType = (typeof EDGE_TYPE)[keyof typeof EDGE_TYPE];

export const LAYOUT_TYPE = {
  dagre: 'Dagre',
  elkForce: 'Elk - Force',
  elkRect: 'Elk - Rect',
  elkLayered: 'Elk - Layered'
} as const;

export type LayoutType = (typeof LAYOUT_TYPE)[keyof typeof LAYOUT_TYPE];

export type GeneratorLocation = 'inline' | 'panel';

/**
 * Single source of truth for editor settings. Each entry's `default` defines the
 * value (and its type); `persist: false` excludes it from the saved settings.
 * The store shape, setters, and the persisted-key list are all derived from this
 * , adding a setting here is the only edit needed (no setter boilerplate, no
 * separate persist allow-list to keep in sync).
 */
const SETTINGS = {
  edgeType: { default: EDGE_TYPE.bezier as EdgeType },
  layoutType: { default: LAYOUT_TYPE.dagre as LayoutType },
  debugMode: { default: false as boolean },
  showMenu: { default: true as boolean },
  showTimings: { default: false as boolean },
  showMinimap: { default: false as boolean },
  showGrid: { default: true as boolean },
  // Transient UI state , not persisted.
  showSearch: { default: false as boolean, persist: false },
  /** Delay applying a node value change until the user commits it. */
  delayedUpdate: { default: false as boolean },
  /** Show value types inline on nodes. */
  inlineTypes: { default: false as boolean },
  /** Show values inline on nodes. */
  inlineValues: { default: false as boolean },
  connectOnClick: { default: true as boolean },
  /**
   * When connecting sockets of different-but-convertible value types,
   * automatically insert a conversion node between them.
   */
  autoConvert: { default: true as boolean },
  snapGrid: { default: false as boolean },
  gridSize: { default: 15 as number },
  generatorLocation: { default: 'panel' as GeneratorLocation }
} satisfies Record<string, { default: unknown; persist?: boolean }>;

type SettingsSchema = typeof SETTINGS;

type SettingsState = {
  [K in keyof SettingsSchema]: SettingsSchema[K]['default'];
};

type SettingsSetters = {
  [K in keyof SettingsSchema as `set${Capitalize<K & string>}`]: (
    value: SettingsSchema[K]['default']
  ) => void;
};

/**
 * Generic accessors so plugin-contributed settings (dynamic keys not in the
 * static {@link SETTINGS} schema) live in the same store as the typed built-ins.
 * The auto-generated panel writes every row through {@link SystemSettingsStore.setSetting};
 * the typed per-key setters above remain for existing typed consumers.
 */
type SettingsDynamicAccess = {
  /** Dynamic plugin-contributed setting values, keyed by descriptor key. */
  [key: string]: unknown;
  /** Set any setting by key (used by the schema-driven panel + plugins). */
  setSetting: (key: string, value: unknown) => void;
};

export type SystemSettingsStore = SettingsState &
  SettingsSetters &
  SettingsDynamicAccess;

const setterName = (key: string): string =>
  `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/** Settings round-tripped to persisted storage (everything except `persist:false`). */
export const PERSISTED_SETTING_KEYS = (
  Object.entries(SETTINGS) as [keyof SettingsSchema, { persist?: boolean }][]
)
  .filter(([, spec]) => spec.persist !== false)
  .map(([key]) => key);

export const systemSettingsFactory = () =>
  create<SystemSettingsStore>((set) => {
    const initial: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(SETTINGS)) {
      initial[key] = spec.default;
      initial[setterName(key)] = (value: unknown) =>
        set({ [key]: value } as Partial<SystemSettingsStore>);
    }
    // Generic setter for dynamic (plugin-contributed) keys and for the
    // schema-driven panel, which writes every row by key.
    initial.setSetting = (key: string, value: unknown) =>
      set({ [key]: value } as Partial<SystemSettingsStore>);
    return initial as SystemSettingsStore;
  });
