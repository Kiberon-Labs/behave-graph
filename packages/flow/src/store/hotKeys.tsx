import type { System } from '@/system';
import { create } from 'zustand';

type Handler = (e?: KeyboardEvent) => any;

export type HotkeyStore = {
  keymap: Record<string, string | string[]>;
  handlers: Record<string, Handler>;
  descriptions: Record<string, string>;
  register(val: {
    action: string;
    trigger: string | string[];
    description?: string;
    handler?: Handler;
  }): void;
  registerDescription(action: string, description: string): void;
  registerHandler(action: string, handler: Handler): void;
};

/**
 * Declarative default hotkey bindings. One table is the single source of truth
 * for the keymap, descriptions, and handlers (previously three objects that had
 * to be kept in sync). Most bindings just dispatch a registered command by id;
 * the few that need key-specific context (the pressed node / number key) use a
 * custom `handler`.
 */
type HotkeyBinding = {
  action: string;
  trigger: string | string[];
  description: string;
  /** Dispatch this command id (with preventDefault/stopPropagation). */
  command?: string;
  /** Or run custom key-specific logic. */
  handler?: (sys: System, e?: KeyboardEvent) => void;
};

const NUMBER_TRIGGERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const traceFromSelection =
  (commandId: string) => (sys: System, e?: KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const selection = sys.selectionStore.getState().selectedNodeId;
    if (selection) sys.runCommand(commandId, { nodeId: selection });
  };

const defaultBindings: HotkeyBinding[] = [
  {
    action: 'SAVE',
    trigger: 'ctrl+s',
    description: 'Save',
    command: 'editor.save'
  },
  {
    action: 'GROUP',
    trigger: 'ctrl+g',
    description: 'Group',
    command: 'selection.group'
  },
  {
    action: 'COPY',
    trigger: ['command+c', 'ctrl+c'],
    description: 'Copy',
    command: 'selection.copy'
  },
  {
    action: 'PASTE',
    trigger: ['command+v', 'ctrl+v'],
    description: 'Paste',
    command: 'selection.paste'
  },
  {
    action: 'SELECT_ALL',
    trigger: 'ctrl+a',
    description: 'Select All',
    command: 'selection.selectAll'
  },
  {
    action: 'UNDO',
    trigger: ['command+z', 'ctrl+z'],
    description: 'Undo',
    command: 'editor.undo'
  },
  {
    action: 'REDO',
    trigger: ['command+shift+z', 'ctrl+shift+z'],
    description: 'Redo',
    command: 'editor.redo'
  },
  {
    action: 'FIND',
    trigger: ['ctrl+f', 'command+f'],
    description: 'Find',
    command: 'editor.find'
  },
  {
    action: 'AUTO_LAYOUT',
    trigger: 'shift+alt+f',
    description: 'Auto Layout',
    command: 'editor.autoLayout'
  },
  {
    action: 'FIT_VIEW',
    trigger: ['f'],
    description: 'Fit View',
    command: 'view.fit'
  },
  {
    action: 'ZOOM_IN',
    trigger: ['ctrl+plus', 'command+plus'],
    description: 'Zoom In',
    command: 'view.zoomIn'
  },
  {
    action: 'ZOOM_OUT',
    trigger: ['command+-', 'ctrl+-'],
    description: 'Zoom Out',
    command: 'view.zoomOut'
  },
  {
    action: 'ZOOM_RESET',
    trigger: 'ctrl+0',
    description: 'Zoom Reset',
    command: 'view.zoomReset'
  },
  {
    action: 'TOGGLE_GRID',
    trigger: ['command+shift+g', 'ctrl+shift+g'],
    description: 'Toggle Grid',
    command: 'view.toggleGrid'
  },
  {
    action: 'TOGGLE_MINIMAP',
    trigger: ['command+shift+m', 'ctrl+shift+m'],
    description: 'Toggle Minimap',
    command: 'view.toggleMinimap'
  },
  {
    action: 'TOGGLE_SNAP_GRID',
    trigger: ['command+shift+s', 'ctrl+shift+s'],
    description: 'Toggle Snap Grid',
    command: 'view.toggleSnapGrid'
  },
  // Bound for the keymap UI; behaviour handled elsewhere or not yet implemented.
  {
    action: 'DUPLICATE',
    trigger: ['command+d', 'ctrl+d'],
    description: 'Duplicate'
  },
  // Deletion is handled natively by reactflow; listed here for the keymap UI.
  {
    action: 'DELETE',
    trigger: ['delete', 'del', 'backspace'],
    description: 'Delete'
  },
  // Context-aware handlers.
  {
    action: 'TRACE_UPSTREAM',
    trigger: 'ctrl+shift+left',
    description: 'Trace Upstream',
    handler: traceFromSelection('node.traceUpstream')
  },
  {
    action: 'TRACE_DOWNSTREAM',
    trigger: 'ctrl+shift+right',
    description: 'Trace Downstream',
    handler: traceFromSelection('node.traceDownstream')
  },
  {
    action: 'SAVE_VIEWPORT',
    trigger: [
      ...NUMBER_TRIGGERS.map((n) => `command+${n}`),
      ...NUMBER_TRIGGERS.map((n) => `ctrl+${n}`)
    ],
    description: 'Save Viewport',
    handler: (sys, event) => {
      event?.preventDefault();
      const reactFlowInstance = sys.refStore.getState().getRef('reactflow');
      if (!event || !reactFlowInstance) return;
      const viewportIndex = parseInt(event.key) - 1;
      if (viewportIndex >= 0 && viewportIndex < 9) {
        sys.graph.setViewport(viewportIndex, reactFlowInstance.getViewport());
        sys.notifications.info(`Saved viewport ${viewportIndex + 1}`);
      }
    }
  },
  {
    action: 'RECALL_VIEWPORT',
    trigger: NUMBER_TRIGGERS,
    description: 'Recall Viewport',
    handler: (sys, event) => {
      event?.preventDefault();
      const reactFlowInstance = sys.refStore.getState().getRef('reactflow');
      if (!event || !reactFlowInstance) return;
      const viewportIndex = parseInt(event.key) - 1;
      if (viewportIndex < 0 || viewportIndex >= 9) return;
      const viewport = sys.graph.viewports[viewportIndex];
      if (!viewport) {
        return;
      }
      reactFlowInstance.setViewport(viewport);
    }
  }
];

const buildDefaults = (sys: System) => {
  const keymap: Record<string, string | string[]> = {};
  const descriptions: Record<string, string> = {};
  const handlers: Record<string, Handler> = {};

  for (const binding of defaultBindings) {
    keymap[binding.action] = binding.trigger;
    descriptions[binding.action] = binding.description;

    if (binding.command) {
      const commandId = binding.command;
      handlers[binding.action] = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        void sys.runCommand(commandId);
      };
    } else if (binding.handler) {
      const handler = binding.handler;
      handlers[binding.action] = (event) => handler(sys, event);
    }
  }

  return { keymap, descriptions, handlers };
};

export const hotKeyStoreFactory = (sys: System) => {
  const { keymap, descriptions, handlers } = buildDefaults(sys);

  return create<HotkeyStore>((set) => ({
    keymap,
    descriptions,
    handlers,

    register(val) {
      set((s) => ({
        handlers: {
          ...s.handlers,
          ...(val.handler ? { [val.action]: val.handler } : {})
        },
        keymap: {
          ...s.keymap,
          [val.action]: val.trigger
        },
        descriptions: {
          ...s.descriptions,
          ...(val.description ? { [val.action]: val.description } : {})
        }
      }));
    },
    registerHandler(name, handler) {
      set((s) => ({
        handlers: {
          ...s.handlers,
          [name]: handler
        }
      }));
    },
    registerDescription(name, desc) {
      set((s) => ({
        descriptions: {
          ...s.descriptions,
          [name]: desc
        }
      }));
    }
  }));
};
