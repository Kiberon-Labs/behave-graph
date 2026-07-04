// Full editor stylesheet (vscode theme vars, rc-dock, reactflow, etc.) so the
// panels render the way they do in the real app.
import '@/index.css';

import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-react';
import { DefaultSystemProvider } from '../../stories/defaults/defaultStoryProvider';

import { AlignmentPanel } from '@/components/panels/alignment';
import { EventsPanel } from '@/components/panels/events';
import { HistoryPanel } from '@/components/panels/history';
import { KeymapsPanel } from '@/components/panels/keymaps';
import { LayersPanel } from '@/components/panels/layers';
import { LegendPanel } from '@/components/panels/legend';
import { LogsPanel } from '@/components/panels/logs';
import { NodeInputsPanel } from '@/components/panels/nodeInputs';
import { NodePickerPanel } from '@/components/panels/nodePicker';
import { PanelPanel } from '@/components/panels/panel';
import { SearchPanel } from '@/components/panels/search';
import { Settings } from '@/components/panels/systemSettings';
import { TracesPanel } from '@/components/panels/traces';
import { VariablesPanel } from '@/components/panels/variables';
import { LocalGraphRunnerPanel } from '@/plugin/graphrunner-local';

/**
 * One pixel-snapshot per panel. The shared {@link DefaultSystemProvider} (the
 * same provider the Storybook stories use) supplies a populated System so each
 * panel renders representative content.
 */
const panels: ReadonlyArray<readonly [name: string, element: ReactElement]> = [
  ['alignment', <AlignmentPanel />],
  ['events', <EventsPanel />],
  ['history', <HistoryPanel />],
  ['keymaps', <KeymapsPanel />],
  ['layers', <LayersPanel />],
  ['legend', <LegendPanel />],
  ['logs', <LogsPanel />],
  ['nodeInputs', <NodeInputsPanel />],
  ['nodePicker', <NodePickerPanel />],
  ['panel', <PanelPanel />],
  ['search', <SearchPanel />],
  ['systemSettings', <Settings />],
  ['traces', <TracesPanel />],
  ['variables', <VariablesPanel />],
  ['localGraphRunner', <LocalGraphRunnerPanel />]
];

afterEach(() => {
  cleanup();
});

describe('panels (visual)', () => {
  it.each(panels)('renders the %s panel', async (name, element) => {
    render(
      <DefaultSystemProvider>
        <div
          data-testid="panel-frame"
          style={{
            width: 640,
            height: 480,
            overflow: 'auto',
            background: 'var(--vscode-editor-background, #1f1f1f)'
          }}
        >
          {element}
        </div>
      </DefaultSystemProvider>
    );

    await expect(page.getByTestId('panel-frame')).toMatchScreenshot(
      `panel-${name}`
    );
  });
});
