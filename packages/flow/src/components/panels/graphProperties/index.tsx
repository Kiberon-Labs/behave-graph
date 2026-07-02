import React, { useState } from 'react';
import { useStore } from 'zustand';
import { VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';
import { Trash } from 'iconoir-react';
import { useActiveGraph } from '@/system/provider';
import type { GraphSession } from '@/system/graphSession';
import { BasePanel } from '../base';
import { SectionTitle } from '../common/SectionTitle';

export function GraphPropertiesPanel() {
  const session = useActiveGraph();
  if (!session) {
    return (
      <BasePanel>
        <div style={{ padding: 12, opacity: 0.7 }}>No graph open.</div>
      </BasePanel>
    );
  }
  return <GraphProperties session={session} />;
}

const GraphProperties: React.FC<{ session: GraphSession }> = ({ session }) => {
  const name = useStore(session.metaStore, (s) => s.name);
  const metadata = useStore(session.metaStore, (s) => s.metadata);
  const { setName, setMetadataValue, removeMetadataKey, setMetadata } =
    session.metaStore.getState();

  const entries = Object.entries(metadata);

  const renameKey = (oldKey: string, newKey: string, value: any) => {
    const trimmed = newKey.trim();
    if (trimmed === oldKey) return;
    const next = { ...session.metaStore.getState().metadata };
    delete next[oldKey];
    if (trimmed) next[trimmed] = value;
    setMetadata(next);
  };

  const addEntry = () => {
    const current = session.metaStore.getState().metadata;
    let i = 1;
    let key = `key${i}`;
    while (key in current) key = `key${++i}`;
    setMetadataValue(key, '');
  };

  return (
    <BasePanel>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}
      >
        <SectionTitle>Name</SectionTitle>
        <VscodeTextfield
          value={name}
          placeholder="Graph name"
          style={{ width: '100%' }}
          onChange={(e: any) => setName(String(e?.target?.value ?? ''))}
        />

        <SectionTitle>Metadata</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.length === 0 && (
            <div
              style={{
                fontSize: 'var(--fs-desc, 0.72rem)',
                color: 'var(--ds-fg-muted)'
              }}
            >
              No metadata. Add a key/value pair below.
            </div>
          )}
          {entries.map(([key, value]) => (
            <MetadataRow
              key={key}
              entryKey={key}
              value={value}
              onRename={renameKey}
              onValueChange={(v) => setMetadataValue(key, v)}
              onRemove={() => removeMetadataKey(key)}
            />
          ))}
          <VscodeButton secondary onClick={addEntry}>
            + Add metadata
          </VscodeButton>
        </div>
      </div>
    </BasePanel>
  );
};

const MetadataRow: React.FC<{
  entryKey: string;
  value: any;
  onRename: (oldKey: string, newKey: string, value: any) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
}> = ({ entryKey, value, onRename, onValueChange, onRemove }) => {
  // Key edits commit on blur (renaming changes identity); value edits are live.
  const [draftKey, setDraftKey] = useState(entryKey);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <VscodeTextfield
        value={draftKey}
        placeholder="key"
        style={{ flex: 1, minWidth: 0 }}
        onChange={(e: any) => setDraftKey(String(e?.target?.value ?? ''))}
        onBlur={() => onRename(entryKey, draftKey, value)}
      />
      <VscodeTextfield
        value={String(value ?? '')}
        placeholder="value"
        style={{ flex: 1, minWidth: 0 }}
        onChange={(e: any) => onValueChange(String(e?.target?.value ?? ''))}
      />
      <VscodeButton secondary iconOnly title="Remove" onClick={onRemove}>
        <Trash />
      </VscodeButton>
    </div>
  );
};
