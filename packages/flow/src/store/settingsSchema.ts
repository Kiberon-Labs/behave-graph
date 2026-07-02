import { createStore, type StoreApi } from 'zustand/vanilla';
import type { FC } from 'react';
import { EDGE_TYPE, LAYOUT_TYPE } from './settings';

/**
 * Schema-driven settings.
 *
 * The Settings panel is auto-generated from a registry of {@link SettingDescriptor}s
 * rather than hand-coded JSX. Built-in settings are seeded as {@link DEFAULT_SETTINGS};
 * plugins contribute their own via `system.registerSetting(...)`, and the panel
 * renders them the same way — so a plugin can surface settings without forking
 * the panel.
 *
 * Descriptors are intentionally plain data (everything except `render`/`when` is
 * JSON-serializable), so a future declarative manifest `contributes.configuration`
 * section can feed this same registry.
 */

export type SettingEnumOption = { value: string; label: string };

/** Live values bag passed to a descriptor's {@link SettingDescriptorBase.when}. */
export type SettingsValues = Record<string, unknown>;

/** Props handed to a `type: 'custom'` descriptor's `render` component. */
export type SettingControlProps = {
  value: unknown;
  setValue: (value: unknown) => void;
  descriptor: SettingDescriptor;
};

type SettingDescriptorBase = {
  /**
   * Unique key. Built-ins are flat (`edgeType`) and match the value-store keys
   * 1:1; plugin settings should be namespaced (`graphRunner.autoStart`) to avoid
   * collisions.
   */
  key: string;
  /** Category heading the row is grouped under, e.g. `"Layout"`. */
  section: string;
  /** Sort order within the section (falls back to registration order). */
  order?: number;
  /** Row label. */
  title?: string;
  /** Secondary description text under the label. */
  description?: string;
  /** Excluded from persisted settings when `false`. Defaults to `true`. */
  persist?: boolean;
  /** Hide the row unless this returns true for the current values. */
  when?: (values: SettingsValues) => boolean;
};

export type SettingDescriptor =
  | (SettingDescriptorBase & { type: 'boolean'; default: boolean })
  | (SettingDescriptorBase & {
      type: 'number';
      default: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (SettingDescriptorBase & {
      type: 'string';
      default: string;
      placeholder?: string;
    })
  | (SettingDescriptorBase & {
      type: 'enum';
      default: string;
      options: SettingEnumOption[];
    })
  | (SettingDescriptorBase & {
      type: 'custom';
      default?: unknown;
      render: FC<SettingControlProps>;
    });

export type SettingsSchemaStore = {
  /** Registered descriptors, in registration order. */
  settings: SettingDescriptor[];
  /** Section names in first-seen order, for stable display grouping. */
  sectionOrder: string[];
  registerSetting: (descriptor: SettingDescriptor) => void;
  registerSettings: (descriptors: SettingDescriptor[]) => void;
};

const toOptions = (values: readonly string[]): SettingEnumOption[] =>
  values.map((value) => ({ value, label: value }));

/**
 * Built-in editor settings, mirroring the previously hand-coded panel. Keys
 * match the value-store keys in {@link file://./settings.ts} exactly, so typed
 * consumers (`settings.edgeType`, …) are unaffected.
 */
export const DEFAULT_SETTINGS: SettingDescriptor[] = [
  {
    key: 'edgeType',
    section: 'Layout',
    type: 'enum',
    default: EDGE_TYPE.bezier,
    options: toOptions(Object.values(EDGE_TYPE)),
    title: 'Edge Type',
    description: 'Select the type of edge to use in the graph editor.'
  },
  {
    key: 'layoutType',
    section: 'Layout',
    type: 'enum',
    default: LAYOUT_TYPE.dagre,
    options: toOptions(Object.values(LAYOUT_TYPE)),
    title: 'Layout Type',
    description: 'Select the type of layout engine to use in the graph editor.'
  },
  {
    key: 'inlineTypes',
    section: 'Accessibility',
    type: 'boolean',
    default: false,
    title: 'Show inline types',
    description:
      'Adds additional spans to help differentiate types for colorblind users.'
  },
  {
    key: 'delayedUpdate',
    section: 'Interaction',
    type: 'boolean',
    default: false,
    title: 'Use delayed interaction',
    description: 'Forces a user to click save to update port.'
  },
  {
    key: 'connectOnClick',
    section: 'Interaction',
    type: 'boolean',
    default: true,
    title: 'Click to connect',
    description: 'Allows you to quick connect nodes by clicking on the 2 port.'
  },
  {
    key: 'autoConvert',
    section: 'Interaction',
    type: 'boolean',
    default: true,
    title: 'Auto-convert types',
    description:
      'When connecting different but convertible types, insert a conversion node automatically.'
  },
  {
    key: 'showMinimap',
    section: 'Display',
    type: 'boolean',
    default: false,
    title: 'Show Minimap',
    description: 'Shows the minimap in the graph editing area.'
  },
  {
    key: 'showGrid',
    section: 'Display',
    type: 'boolean',
    default: true,
    title: 'Show Grid',
    description: 'Shows the grid in the graph editing area.'
  },
  {
    key: 'snapGrid',
    section: 'Display',
    type: 'boolean',
    default: false,
    title: 'Snap to Grid',
    description: 'Snaps nodes to the grid while dragging.'
  },
  {
    key: 'showTimings',
    section: 'Performance',
    type: 'boolean',
    default: false,
    title: 'Show execution time',
    description: 'Shows how long it takes for a node to process.'
  }
];

export const settingsSchemaStoreFactory = (
  initial: SettingDescriptor[] = DEFAULT_SETTINGS
): StoreApi<SettingsSchemaStore> =>
  createStore<SettingsSchemaStore>((set, get) => {
    const registerSetting = (descriptor: SettingDescriptor): void => {
      const { settings, sectionOrder } = get();
      if (settings.some((existing) => existing.key === descriptor.key)) {
        console.warn(
          `Setting "${descriptor.key}" is already registered; ignoring duplicate.`
        );
        return;
      }
      set({
        settings: [...settings, descriptor],
        sectionOrder: sectionOrder.includes(descriptor.section)
          ? sectionOrder
          : [...sectionOrder, descriptor.section]
      });
    };

    // Seed the built-in descriptors as the starting state.
    const settings: SettingDescriptor[] = [];
    const sectionOrder: string[] = [];
    for (const descriptor of initial) {
      if (settings.some((existing) => existing.key === descriptor.key)) continue;
      settings.push(descriptor);
      if (!sectionOrder.includes(descriptor.section)) {
        sectionOrder.push(descriptor.section);
      }
    }

    return {
      settings,
      sectionOrder,
      registerSetting,
      registerSettings: (descriptors) => descriptors.forEach(registerSetting)
    };
  });
