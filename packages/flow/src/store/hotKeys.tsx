import { applyDagreLayout } from '@/layout/dagre';
import { applyElkLayout } from '@/layout/elk';
import type { System } from '@/system';
import { create } from 'zustand';

export type HotkeyStore = {
  keymap: Record<string, string | string[]>;
  handlers: Record<string, (e?: KeyboardEvent) => any>;
  descriptions: Record<string, string>;
  register(action: string, trigger: string | string[]): void;
  registerDescription(action: string, description: string): void;
  registerHandler(action: string, handler: (e?: KeyboardEvent) => any): void;
};

export const hotKeyStoreFactory = (sys: System) =>
  create<HotkeyStore>((set) => ({
    keymap: {
      SELECT_ALL: 'ctrl+a',
      DUPLICATE: ['command+d', 'ctrl+d'],
      GROUP: 'ctrl+g',
      UNGROUP: 'ctrl+shift+g',
      SAVE: 'ctrl+s',
      LOAD: 'ctrl+o',
      FIND: 'ctrl+f',
      AUTO_LAYOUT: 'shift+alt+f',
      COPY: ['command+c', 'ctrl+c'],
      PASTE: ['command+v', 'ctrl+v'],
      DELETE: ['delete', 'del', 'backspace'],
      UNDO: ['command+z', 'ctrl+z'],
      REDO: ['command+shift+z', 'ctrl+shift+z'],
      SAVE_VIEWPORT: [
        'command+1',
        'command+2',
        'command+3',
        'command+4',
        'command+5',
        'command+6',
        'command+7',
        'command+8',
        'command+9',
        'ctrl+1',
        'ctrl+2',
        'ctrl+3',
        'ctrl+4',
        'ctrl+5',
        'ctrl+6',
        'ctrl+7',
        'ctrl+8',
        'ctrl+9'
      ],
      RECALL_VIEWPORT: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      RESET: 'ctrl+r',
      ZOOM_IN: ['ctrl+plus', 'command+plus'],
      ZOOM_OUT: ['command+-', 'ctrl+-'],
      ZOOM_RESET: 'ctrl+0',
      TOGGLE_GRID: ['command+shift+g', 'ctrl+shift+g'],
      TOGGLE_MINIMAP: ['command+shift+m', 'ctrl+shift+m'],
      TOGGLE_SNAP_GRID: ['command+shift+s', 'ctrl+shift+s'],
      FIT_VIEW: ['f'],
      TRACE_DOWNSTREAM: 'ctrl+shift+right',
      TRACE_UPSTREAM: 'ctrl+shift+left'
    },
    descriptions: {
      TRACE_DOWNSTREAM: 'Trace Downstream',
      TRACE_UPSTREAM: 'Trace Upstream',
      AUTO_LAYOUT: 'Auto Layout',
      COPY: 'Copy',
      PASTE: 'Paste',
      DELETE: 'Delete',
      UNDO: 'Undo',
      REDO: 'Redo',
      SELECT_ALL: 'Select All',
      DUPLICATE: 'Duplicate',
      GROUP: 'Group',
      UNGROUP: 'Ungroup',
      SAVE: 'Save',
      LOAD: 'Load',
      FIND: 'Find',
      RESET: 'Reset',
      FIT_VIEW: 'Fit View',
      ZOOM_IN: 'Zoom In',
      ZOOM_OUT: 'Zoom Out',
      ZOOM_RESET: 'Zoom Reset',
      TOGGLE_GRID: 'Toggle Grid',
      TOGGLE_MINIMAP: 'Toggle Minimap',
      TOGGLE_SNAP_GRID: 'Toggle Snap Grid',
      SAVE_VIEWPORT: 'Save Viewport',
      RECALL_VIEWPORT: 'Recall Viewport'
    },
    handlers: {
      TRACE_UPSTREAM: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          const selection = sys.selectionStore.getState().selectedNodeId;
          if (!selection) {
            return;
          }
          sys.actionStore.getState().actions.traceUpstream(selection);
        }
      },
      TRACE_DOWNSTREAM: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          const selection = sys.selectionStore.getState().selectedNodeId;
          if (!selection) {
            return;
          }
          sys.actionStore.getState().actions.traceDownstream(selection);
        }
      },
      FIT_VIEW: (event) => {
        if (event) {
          event.preventDefault();
          const reactFlowInstance = sys.refStore.getState().getRef('reactflow');
          reactFlowInstance?.fitView({
            padding: 0.2,
            includeHiddenNodes: true
          });
        }
      },

      TOGGLE_SNAP_GRID: (event) => {
        if (event) {
          event.preventDefault();
          const settings = sys.systemSettings.getState();
          settings.setSnapGrid(!settings.snapGrid);
        }
      },
      TOGGLE_GRID: (event) => {
        if (event) {
          event.preventDefault();
          const settings = sys.systemSettings.getState();
          settings.setShowGrid(!settings.showGrid);
        }
      },
      SAVE_VIEWPORT: (event) => {
        if (event) {
          event?.preventDefault();
          const reactFlowInstance = sys.refStore.getState().getRef('reactflow');
          const graph = sys.graph;
          if (reactFlowInstance) {
            const currentViewport = reactFlowInstance.getViewport();
            const key = event.key; // Get pressed key (e.g., '1', '2', etc.)
            const viewportIndex = parseInt(key) - 1; // Calculate 0-based index

            if (viewportIndex >= 0 && viewportIndex < 9) {
              graph.setViewport(viewportIndex, currentViewport);
            }
          }
        }
      },
      RECALL_VIEWPORT: (event) => {
        if (event) {
          event.preventDefault();
          const key = event.key;
          const graph = sys.graph;
          const reactFlowInstance = sys.refStore.getState().getRef('reactflow');

          const viewportIndex = parseInt(key) - 1;

          if (viewportIndex >= 0 && viewportIndex < 9 && reactFlowInstance) {
            const viewport = graph.viewports[viewportIndex];
            if (!viewport) {
              sys.pubsub.publish('missingViewPort', {
                index: viewportIndex
              });
              return;
            }
            reactFlowInstance.setViewport(viewport);
          }
        }
      },
      SELECT_ALL: (event) => {
        if (event) {
          event.stopPropagation();
          event.preventDefault();
          sys.nodeStore.getState().setNodes((nodes) => {
            return nodes.map((x) => {
              return {
                ...x,
                selected: true
              };
            });
          });
        }
      },
      ZOOM_IN: (event) => {
        if (event) {
          event.stopPropagation();
          event.preventDefault();
          sys.refStore
            .getState()
            .getRef('reactflow')
            ?.zoomIn({ duration: 300 });
        }
      },
      ZOOM_OUT: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          sys.refStore
            .getState()
            .getRef('reactflow')
            ?.zoomOut({ duration: 300 });
        }
      },
      RESET_ZOOM: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          const reactflow = sys.refStore.getState().getRef('reactflow');

          if (!reactflow) return;

          const existing = reactflow.getViewport();
          reactflow.setViewport({ ...existing, zoom: 1 });
        }
      },
      AUTO_LAYOUT: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();

          switch (sys.systemSettings.getState().layoutType) {
            case 'Dagre':
              applyDagreLayout(sys);
              break;
            case 'Elk - Layered':
              applyElkLayout(sys);
              break;
          }
        }
      },
      UNDO: (event) => {
        if (event) {
          event.preventDefault();
          sys.undoManager.undo();
        }
      },
      REDO: (event) => {
        if (event) {
          event.preventDefault();
          sys.undoManager.redo();
        }
      }
    },

    register(action, trigger) {
      set((s) => ({
        keymap: {
          ...s.keymap,
          [action]: trigger
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
