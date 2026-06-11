import React from 'react';
import { VscodeBadge, VscodeDivider } from '@vscode-elements/react-elements';
import { useStore } from 'zustand';
import { useSystem } from '@/system/provider';
import styles from './styles.module.css';
import { BasePanel } from '../base';

export function HistoryPanel() {
  const system = useSystem();
  const history = useStore(system.undoManager.store, (s) => s.history);
  const redoStack = useStore(system.undoManager.store, (s) => s.redoStack);

  const historyNewestFirst = React.useMemo(
    () => [...history].reverse(),
    [history]
  );

  const Row = ({
    kind,
    index,
    name
  }: {
    kind: 'undo' | 'redo';
    index: number;
    name: string;
  }) => {
    return (
      <div
        className={`${styles.row} ${kind === 'undo' ? styles.undo : styles.redo}`}
        title={name}
      >
        <div className={styles.badgeCell}>
          <VscodeBadge className={styles.kindBadge}>
            {kind === 'undo' ? 'Undo' : 'Redo'}
          </VscodeBadge>
        </div>
        <div className={styles.index}>{index}</div>
        <div className={styles.name}>{name}</div>
      </div>
    );
  };

  return (
    <BasePanel>
      <div className={styles.sectionTitle}>
        <div>Previous</div>
        <VscodeBadge className={styles.countBadge}>
          {history.length}
        </VscodeBadge>
      </div>

      <div className={styles.list}>
        {historyNewestFirst.map((entry, idx) => (
          <Row
            key={`${entry.name}-${idx}`}
            kind="undo"
            index={historyNewestFirst.length - idx}
            name={entry.name}
          />
        ))}
        {historyNewestFirst.length === 0 && (
          <div className={styles.empty}>No previous actions</div>
        )}
      </div>

      <div className={styles.now}>
        <VscodeDivider />
        <div className={styles.nowLabel}>Now</div>
      </div>

      <div className={styles.sectionTitle}>
        <div>Future</div>
        <VscodeBadge className={styles.countBadge}>
          {redoStack.length}
        </VscodeBadge>
      </div>

      {redoStack.length !== 0 && (
        <div className={styles.list}>
          {redoStack.map((entry, idx) => (
            <Row
              key={`${entry.name}-${idx}`}
              kind="redo"
              index={idx + 1}
              name={entry.name}
            />
          ))}
        </div>
      )}
    </BasePanel>
  );
}
