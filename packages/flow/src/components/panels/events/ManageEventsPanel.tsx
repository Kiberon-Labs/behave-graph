import React, { useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeDivider,
  VscodeTree,
  VscodeTreeItem
} from '@vscode-elements/react-elements';
import { Plus, Edit } from 'iconoir-react';

import { useSystem } from '@/system';
import styles from './styles.module.css';
import { BasePanel } from '../base';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { Icon } from '@/components/primitives/icon';

type CustomEventJSON = NonNullable<GraphJSON['customEvents']>[number];

const nextNumericId = (events: Array<{ id: string }>) => {
  const used = new Set(events.map((e) => String(e.id)));
  let i = 0;
  while (used.has(String(i))) i += 1;
  return String(i);
};

interface ManageEventsPanelProps {
  onSelectEvent: (eventUiId: string) => void;
}

export const ManageEventsPanel: React.FC<ManageEventsPanelProps> = ({
  onSelectEvent
}) => {
  const system = useSystem();
  const rawEvents = useStore(system.eventsStore, (s) => s.customEvents);

  const persistedEvents = useMemo(() => Object.values(rawEvents), [rawEvents]);

  const addNewEvent = () => {
    const nextId = nextNumericId(persistedEvents);
    const created: CustomEventJSON = {
      id: nextId,
      name: 'NewCustomEvent',
      parameters: []
    };

    system.eventsStore.getState().addCustomEvent(created);
    onSelectEvent(created.id);
  };

  return (
    <BasePanel>
      <div className={styles.root}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Custom Events</h2>
          <Icon title="New event" onClick={addNewEvent}>
            <Plus />
          </Icon>
        </div>
        <VscodeDivider />
        <div className={styles.content}>
          {persistedEvents.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateText}>No custom events yet.</div>
            </div>
          ) : (
            <VscodeTree>
              {persistedEvents.map((evt) => {
                const eventId = String(evt.id ?? '');
                const paramCount = (evt.parameters ?? []).length;

                return (
                  <VscodeTreeItem key={evt.id}>
                    <div className={styles.eventName}>
                      {evt.name ?? 'CustomEvent'}
                    </div>
                    <div slot="description">
                      <div className={styles.eventMeta}>
                        ID: {eventId} • {paramCount} parameter
                        {paramCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div slot="actions">
                      <Icon
                        title="Edit event"
                        onClick={() => onSelectEvent(eventId)}
                      >
                        <Edit width={16} height={16} />
                      </Icon>
                    </div>
                  </VscodeTreeItem>
                );
              })}
            </VscodeTree>
          )}
        </div>
      </div>
    </BasePanel>
  );
};
