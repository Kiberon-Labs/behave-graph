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
import { HotKeys } from '@/components/hotKeys';

export class TabLoader {
  public readonly tabs: Record<string, () => TabData> = {};

  constructor(system: System) {
    this.register('graph', () => {
      const initialGraph = system.flowStore.getState().initialGraph ?? {
        nodes: []
      };
      return {
        id: 'graph',
        closable: true,
        cached: true,
        group: 'graph',
        title: 'Graph',
        content: () => (
          <ErrorBoundary fallback={'whoops'}>
            <HotKeys>
              <Flow
                registry={system.registry}
                initialGraph={initialGraph}
                examples={{}}
              />
            </HotKeys>
          </ErrorBoundary>
        )
      };
    });

    this.register('system:settings', () => {
      return {
        id: 'system:settings',
        closable: true,
        group: 'default',
        title: <div>System Settings</div>,
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
        title: <div>Distribution + Alignment</div>,
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
  }

  load(tab: TabBase): TabData | undefined {
    if (!tab.id) {
      return;
    }
    return this.tabs[tab.id]?.();
  }

  register(id: string, loader: () => TabData) {
    this.tabs[id] = loader;
  }
}
