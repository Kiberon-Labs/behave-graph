import { plugin } from '@/system/plugin';
import type { System } from '@/system/system';
import { applyDagreLayout } from './dagre';
import { applyElkLayout } from './elk';

export * from './dagre';
export * from './elk';

/**
 * Available auto-layout engines. `Dagre` is a small, synchronous layered layout;
 * the `Elk - *` options use elkjs (~1.4 MB, loaded lazily on first use) for
 * higher-quality layouts.
 */
export const LAYOUT_TYPE = {
  dagre: 'Dagre',
  elkForce: 'Elk - Force',
  elkRect: 'Elk - Rect',
  elkLayered: 'Elk - Layered'
} as const;

export type LayoutType = (typeof LAYOUT_TYPE)[keyof typeof LAYOUT_TYPE];

/**
 * Run the currently-selected auto-layout engine against the focused graph.
 * Reads the `layoutType` setting (registered by this plugin) to pick the engine.
 */
export const applyAutoLayout = (system: System): void => {
  switch (system.getSetting<LayoutType>('layoutType')) {
    case LAYOUT_TYPE.dagre:
      void applyDagreLayout(system);
      break;
    case LAYOUT_TYPE.elkLayered:
      void applyElkLayout(system, 'org.eclipse.elk.layered');
      break;
    case LAYOUT_TYPE.elkForce:
      void applyElkLayout(system, 'org.eclipse.elk.force');
      break;
    case LAYOUT_TYPE.elkRect:
      void applyElkLayout(system, 'org.eclipse.elk.rectpacking');
      break;
  }
};

/**
 * Adds graph auto-layout (Dagre + ELK) to the editor. elkjs and dagre are heavy
 * dependencies that not every host needs, so they live here rather than in the
 * core editor  register this plugin (directly or via the kitchen-sink plugin)
 * to opt in.
 *
 * The plugin:
 * - registers the `layoutType` setting (the engine picker in the Settings panel);
 * - registers the `editor.autoLayout` command that the "Auto Layout" hotkey and
 *   menu dispatch to.
 *
 * Without it, `editor.autoLayout` is simply unregistered (the hotkey no-ops).
 */
export const layoutPlugin = plugin(
  (system: System) => {
    system.registerSetting({
      key: 'layoutType',
      section: 'Layout',
      type: 'enum',
      default: LAYOUT_TYPE.dagre,
      options: Object.values(LAYOUT_TYPE).map((value) => ({
        value,
        label: value
      })),
      title: 'Layout Type',
      description:
        'Select the type of layout engine to use in the graph editor.'
    });

    system.commandStore.getState().register({
      id: 'editor.autoLayout',
      title: 'Auto Layout',
      run: (ctx) => applyAutoLayout(ctx.editor)
    });
  },
  { name: 'layout' }
);
