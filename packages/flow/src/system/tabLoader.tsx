import { Flow } from '@/components/Flow';
import type { TabBase, TabData } from 'rc-dock';
import { ErrorBoundary } from 'react-error-boundary';
import type { System } from './system';
import { Settings } from '@/components/panels/systemSettings';
import { LogsPanel } from '@/components/panels/logs';
import { VariablesPanel } from '@/components/panels/variables';
import { NodeInputsPanel } from '@/components/panels/nodeInputs';
import { AlignmentPanel } from '@/components/panels/alignment';
import { SearchPanel } from '@/components/panels/search';
import { KeymapsPanel } from '@/components/panels/keymaps';
import { EventsPanel } from '@/components/panels/events';
import { TracesPanel } from '@/components/panels/traces';
import { LegendPanel } from '@/components/panels/legend';
import { HistoryPanel } from '@/components/panels/history';
import { HotKeys } from '@/components/hotKeys';
import { NodePickerPanel } from '@/components/panels/nodePicker';
import { PanelPanel } from '@/components/panels/panel';
import { LayersPanel } from '@/components/panels/layers';
import { GraphPropertiesPanel } from '@/components/panels/graphProperties';
import { GraphProvider } from './provider';
import { useStore } from 'zustand';
import type { GraphSession } from './graphSession';
import {
  DEFAULT_GRAPH_ID,
  isGraphTabId,
  sessionIdFromTabId,
  tabIdForSession
} from '@/components/layoutController/utils';

/** Live graph tab title , re-renders when the graph is renamed. */
const GraphTabTitle = ({ session }: { session: GraphSession }) => {
  const name = useStore(session.metaStore, (s) => s.name);
  return <>{name}</>;
};

export class TabLoader {
  public readonly tabs: Record<string, () => TabData> = {};
  private readonly system: System;

  constructor(system: System) {
    this.system = system;

    // The default graph tab. Other graphs are loaded dynamically by id
    // (see `loadGraphTab`).
    this.register(DEFAULT_GRAPH_ID, () => this.buildGraphTab(DEFAULT_GRAPH_ID));

    this.register('system:settings', () => {
      return {
        id: 'system:settings',
        closable: true,
        group: 'default',
        title: 'System Settings',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <Settings />
          </ErrorBoundary>
        )
      };
    });

    this.register('distribution', () => {
      return {
        id: 'distribution',
        closable: true,
        group: 'default',
        title: 'Distribution + Alignment',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <AlignmentPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('variables', () => {
      return {
        id: 'variables',
        closable: true,
        title: 'Variables',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <VariablesPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('logs', () => {
      return {
        id: 'logs',
        closable: true,
        title: 'Logs',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <LogsPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('graphProperties', () => {
      return {
        id: 'graphProperties',
        closable: true,
        title: 'Graph Properties',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <GraphPropertiesPanel />
          </ErrorBoundary>
        )
      };
    });
    this.register('find', () => {
      return {
        id: 'find',
        closable: true,
        title: 'Find',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <SearchPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('nodeInputs', () => {
      return {
        id: 'nodeInputs',
        closable: true,
        title: 'Node Inputs',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <NodeInputsPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('keymaps', () => {
      return {
        id: 'keymaps',
        closable: true,
        title: 'Keyboard Shortcuts',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <KeymapsPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('events', () => {
      return {
        id: 'events',
        closable: true,
        title: 'Events',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <EventsPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('traces', () => {
      return {
        id: 'traces',
        closable: true,
        title: 'Traces',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <TracesPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('legend', () => {
      return {
        id: 'legend',
        closable: true,
        title: 'Legend',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <LegendPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('history', () => {
      return {
        id: 'history',
        closable: true,
        title: 'History',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <HistoryPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('layers', () => {
      return {
        id: 'layers',
        closable: true,
        title: 'Layers',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <LayersPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('nodepicker', () => {
      return {
        id: 'nodepicker',
        closable: true,
        cached: true,
        title: 'Add Node',
        group: 'headless',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <NodePickerPanel />
          </ErrorBoundary>
        )
      };
    });

    this.register('panels', () => {
      return {
        id: 'panels',
        closable: true,
        title: 'Panels',
        group: 'default',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <PanelPanel />
          </ErrorBoundary>
        )
      };
    });

    // The 'conversation' tab is provided by the AI nodes package's editor
    // plugin (`@kiberon-labs/behave-graph-nodes-ai/ui`), which owns the chat
    // store and panel.
  }

  load(tab: TabBase): TabData | undefined {
    if (!tab.id) {
      return;
    }
    // Dynamic per-graph tabs (`graph:<sessionId>`) are not in the registry.
    if (isGraphTabId(tab.id) && tab.id !== DEFAULT_GRAPH_ID) {
      return this.buildGraphTab(tab.id);
    }
    return this.tabs[tab.id]?.();
  }

  register(id: string, loader: () => TabData) {
    this.tabs[id] = loader;
  }

  /**
   * Build the TabData for a graph tab, resolving (or lazily creating) its
   * session and wrapping the canvas in a {@link GraphProvider} so it stays bound
   * to its own graph regardless of which tab is focused.
   */
  private buildGraphTab(tabId: string): TabData {
    const sessionId = sessionIdFromTabId(tabId);
    const session = this.system.getOrCreateSession(sessionId);
    return {
      id: tabIdForSession(sessionId),
      closable: true,
      cached: true,
      group: 'graph',
      title: <GraphTabTitle session={session} />,
      content: () => (
        <ErrorBoundary fallback={'whoops'}>
          <GraphProvider value={session}>
            <HotKeys>
              <Flow />
            </HotKeys>
          </GraphProvider>
        </ErrorBoundary>
      )
    };
  }
}
