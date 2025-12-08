import { useSystem } from '@/system/provider';
import { EDGE_TYPE, LAYOUT_TYPE, type EdgeType } from '@/store/settings';

import {
  VscodeCheckbox,
  VscodeLabel,
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';
import { useStore } from 'zustand';

const EdgeValues = Object.values(EDGE_TYPE);
const LayoutValues = Object.values(LAYOUT_TYPE);

const Description = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="text-sm text-gray-400 dark:text-gray-500">{children}</span>
  );
};

export const Settings = () => {
  const system = useSystem();

  const settings = useStore(system.systemSettings);

  return (
    <div
      className="h-full w-full flex-col flex-1 p-1"
      style={{
        overflow: 'auto'
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 justify-start">
          <VscodeLabel>Edge Type</VscodeLabel>
          <Description>
            Select the type of edge to use in the graph editor.
          </Description>
          <VscodeSingleSelect
            value={settings.edgeType}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                settings.setEdgeType(value as EdgeType);
              }
            }}
          >
            <VscodeOption value="">Select an edge type...</VscodeOption>
            {EdgeValues.map((type) => (
              <VscodeOption key={type} value={type}>
                {type}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        </div>
        <div className="flex flex-col gap-1 justify-start">
          <VscodeLabel>Layout Type</VscodeLabel>
          <Description>
            Select the type of layout engine to use in the graph editor.
          </Description>
          <VscodeSingleSelect
            value={settings.layoutType}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                settings.setLayoutType(value as LayoutType);
              }
            }}
          >
            <VscodeOption value="">Select a layout type...</VscodeOption>
            {LayoutValues.map((type) => (
              <VscodeOption key={type} value={type}>
                {type}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) => settings.setInlineTypes(Boolean(checked))}
            checked={settings.inlineTypes}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Show inline types</VscodeLabel>
            <Description>
              Adds additional spans to help differentiate types for colorblind
              users.
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setInlineValues(Boolean(event.target?.checked))
            }
            checked={settings.inlineValues}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Show inline values</VscodeLabel>
            <Description>
              Shows values directly on the node. Useful for debugging but can be
              cluttered.
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setDelayedUpdate(Boolean(event.target?.checked))
            }
            checked={settings.delayedUpdate}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Use delayed interaction</VscodeLabel>
            <Description>
              Forces a user to click save to update port.
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setConnectOnClick(Boolean(event.target?.checked))
            }
            checked={settings.connectOnClick}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Click to connect</VscodeLabel>
            <Description>
              Allows you to quick connect nodes by clicking on the 2 port.
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setShowTimings(Boolean(event.target?.checked))
            }
            checked={settings.showTimings}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Show execution time</VscodeLabel>
            <Description>
              Shows how long it takes for a node to process.
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setShowMinimap(Boolean(event.target?.checked))
            }
            checked={settings.showMinimap}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Show Minimap</VscodeLabel>
            <Description>
              Shows the minimap in the graph editing area
            </Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setShowGrid(Boolean(event.target?.checked))
            }
            checked={settings.showGrid}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Show Grid</VscodeLabel>
            <Description>Shows the grid in the graph editing area</Description>
          </div>
        </div>
        <div className="flex gap-1 justify-start">
          <VscodeCheckbox
            toggle
            onChange={(event) =>
              settings.setSnapGrid(Boolean(event.target?.checked))
            }
            checked={settings.snapGrid}
          />
          <div className="flex flex-col justify-start gap-0.5">
            <VscodeLabel>Snap to Grid</VscodeLabel>
            <Description>Snaps nodes to the grid while dragging</Description>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex gap-1 justify-start">
            <div style={{ width: 'var(--component-spacing-md)' }}></div>
            {/* <Select
                            value={settings.layoutType}
                            onValueChange={(value: LayoutType) =>
                                settings.setLayoutType(value)
                            }
                        >
                            <Select.Trigger
                                span="Layout Type"
                                value={settings.layoutType}
                            />
                            <Select.Content>
                                {LayoutValues.map((value, index) => {
                                    return (
                                        <Select.Item value={value!} key={index}>
                                            {value}
                                        </Select.Item>
                                    );
                                })}
                            </Select.Content>
                        </Select> */}
          </div>
        </div>
      </div>
    </div>
  );
};
