import { useSystem } from '@/system/provider';
import {
  EDGE_TYPE,
  LAYOUT_TYPE,
  type EdgeType,
  type LayoutType
} from '@/store/settings';

import {
  VscodeCheckbox,
  VscodeDivider,
  VscodeLabel,
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';
import { useStore } from 'zustand';
import styles from './styles.module.css';
import { BasePanel } from '../base';

const EdgeValues = Object.values(EDGE_TYPE);
const LayoutValues = Object.values(LAYOUT_TYPE);

const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.title}>{children}</div>;
};

const Description = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        fontSize: '0.85em',
        color: 'var(--vscode-descriptionForeground)',
        opacity: 0.9
      }}
    >
      {children}
    </div>
  );
};

const SelectSetting = ({
  label,
  description,
  value,
  onChange,
  children
}: {
  label: string;
  description: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-1 justify-start">
      <VscodeLabel>{label}</VscodeLabel>
      <Description>{description}</Description>
      <VscodeSingleSelect
        value={value}
        onChange={(e: any) => {
          const next = e?.target?.value as string | undefined;
          if (next) onChange(next);
        }}
      >
        {children}
      </VscodeSingleSelect>
    </div>
  );
};

const ToggleSetting = ({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <div className="flex gap-2 justify-start">
      <VscodeCheckbox
        toggle
        checked={checked}
        onChange={(event: any) => onChange(Boolean(event?.target?.checked))}
      />
      <div className="flex flex-col justify-start gap-0.5">
        <VscodeLabel>{label}</VscodeLabel>
        <Description>{description}</Description>
      </div>
    </div>
  );
};

export const Settings = () => {
  const system = useSystem();

  const settings = useStore(system.systemSettings);

  return (
    <BasePanel>
      <div className="flex flex-col gap-3">
        <SectionTitle>Layout</SectionTitle>
        <SelectSetting
          label="Edge Type"
          description="Select the type of edge to use in the graph editor."
          value={settings.edgeType}
          onChange={(value) => settings.setEdgeType(value as EdgeType)}
        >
          <VscodeOption value="">Select an edge type...</VscodeOption>
          {EdgeValues.map((type) => (
            <VscodeOption key={type} value={type}>
              {type}
            </VscodeOption>
          ))}
        </SelectSetting>

        <SelectSetting
          label="Layout Type"
          description="Select the type of layout engine to use in the graph editor."
          value={settings.layoutType}
          onChange={(value) => settings.setLayoutType(value as LayoutType)}
        >
          <VscodeOption value="">Select a layout type...</VscodeOption>
          {LayoutValues.map((type) => (
            <VscodeOption key={type} value={type}>
              {type}
            </VscodeOption>
          ))}
        </SelectSetting>

        <VscodeDivider />

        <SectionTitle>Accessibility</SectionTitle>
        <ToggleSetting
          label="Show inline types"
          description={
            'Adds additional spans to help differentiate types for colorblind users.'
          }
          checked={settings.inlineTypes}
          onChange={(value) => settings.setInlineTypes(value)}
        />

        <VscodeDivider />

        <SectionTitle>Interaction</SectionTitle>
        <ToggleSetting
          label="Use delayed interaction"
          description={'Forces a user to click save to update port.'}
          checked={settings.delayedUpdate}
          onChange={(value) => settings.setDelayedUpdate(value)}
        />
        <ToggleSetting
          label="Click to connect"
          description={
            'Allows you to quick connect nodes by clicking on the 2 port.'
          }
          checked={settings.connectOnClick}
          onChange={(value) => settings.setConnectOnClick(value)}
        />

        <VscodeDivider />

        <SectionTitle>Display</SectionTitle>
        <ToggleSetting
          label="Show inline values"
          description={
            'Shows values directly on the node. Useful for debugging but can be cluttered.'
          }
          checked={settings.inlineValues}
          onChange={(value) => settings.setInlineValues(value)}
        />
        <ToggleSetting
          label="Show Minimap"
          description={'Shows the minimap in the graph editing area.'}
          checked={settings.showMinimap}
          onChange={(value) => settings.setShowMinimap(value)}
        />
        <ToggleSetting
          label="Show Grid"
          description={'Shows the grid in the graph editing area.'}
          checked={settings.showGrid}
          onChange={(value) => settings.setShowGrid(value)}
        />
        <ToggleSetting
          label="Snap to Grid"
          description={'Snaps nodes to the grid while dragging.'}
          checked={settings.snapGrid}
          onChange={(value) => settings.setSnapGrid(value)}
        />

        <VscodeDivider />

        <SectionTitle>Performance</SectionTitle>
        <ToggleSetting
          label="Show execution time"
          description={'Shows how long it takes for a node to process.'}
          checked={settings.showTimings}
          onChange={(value) => settings.setShowTimings(value)}
        />
      </div>
    </BasePanel>
  );
};
