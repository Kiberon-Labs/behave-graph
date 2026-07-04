import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeLabel,
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system/provider';
import { BasePanel } from '@/components/panels/base';
import type { BackupController } from '../controller';
import type { BackupSnapshot } from '../storage';
import styles from './styles.module.css';

const formatTime = (ms: number): string => {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
};

/**
 * Browse and restore local graph backups. Restoring opens the snapshot in a new
 * tab so the current work is never overwritten. Rendered from the autosave
 * plugin's registered `autosaveBackups` tab.
 */
export const BackupPanel = () => {
  const system = useSystem();
  const controller = system.backups as BackupController | undefined;

  if (!controller) {
    return (
      <BasePanel>
        <div className={styles.empty}>Backups are not available.</div>
      </BasePanel>
    );
  }

  return <BackupPanelBody controller={controller} />;
};

const BackupPanelBody = ({ controller }: { controller: BackupController }) => {
  const snapshots = useStore(controller.store, (s) => s.snapshots);
  const running = useStore(controller.store, (s) => s.running);
  const lastBackupAt = useStore(controller.store, (s) => s.lastBackupAt);

  const onRestore = (snapshot: BackupSnapshot) => {
    controller.restore(snapshot.id);
  };

  const onDelete = (snapshot: BackupSnapshot) => {
    controller.deleteSnapshot(snapshot.id);
  };

  const onClearAll = () => {
    if (
      typeof confirm === 'function' &&
      !confirm('Delete all local backups? This cannot be undone.')
    ) {
      return;
    }
    controller.clearAll();
  };

  return (
    <BasePanel>
      <div className={styles.content}>
        <div className={styles.header}>
          <VscodeLabel>Local Backups</VscodeLabel>
          <span className={styles.helpText}>
            {running
              ? 'Autosave is on. Snapshots are kept in this browser only.'
              : 'Autosave is off. Enable it in Settings, or back up on demand.'}
            {lastBackupAt ? ` Last backup: ${formatTime(lastBackupAt)}.` : ''}
          </span>
        </div>

        <div className={styles.toolbar}>
          <VscodeButton onClick={() => controller.backupNow()}>
            Back up now
          </VscodeButton>
          <VscodeButton
            secondary
            disabled={snapshots.length === 0}
            onClick={onClearAll}
          >
            Clear all
          </VscodeButton>
        </div>

        {snapshots.length === 0 ? (
          <div className={styles.empty}>
            No backups yet. A copy is saved automatically when a graph changes
            (with autosave on), or press &ldquo;Back up now&rdquo;.
          </div>
        ) : (
          <VscodeTable className={styles.table} zebra>
            <VscodeTableHeader slot="header">
              <VscodeTableHeaderCell>Graph</VscodeTableHeaderCell>
              <VscodeTableHeaderCell>When</VscodeTableHeaderCell>
              <VscodeTableHeaderCell>Nodes</VscodeTableHeaderCell>
              <VscodeTableHeaderCell>Actions</VscodeTableHeaderCell>
            </VscodeTableHeader>
            <VscodeTableBody slot="body">
              {snapshots.map((snapshot) => (
                <VscodeTableRow key={snapshot.id}>
                  <VscodeTableCell className={styles.nameCell}>
                    <span className={styles.name} title={snapshot.name}>
                      {snapshot.name || 'Untitled'}
                    </span>
                  </VscodeTableCell>
                  <VscodeTableCell>
                    {formatTime(snapshot.timestamp)}
                  </VscodeTableCell>
                  <VscodeTableCell>{snapshot.nodeCount}</VscodeTableCell>
                  <VscodeTableCell className={styles.actionsCell}>
                    <div className={styles.buttonGroup}>
                      <VscodeButton onClick={() => onRestore(snapshot)}>
                        Restore
                      </VscodeButton>
                      <VscodeButton
                        secondary
                        onClick={() => onDelete(snapshot)}
                      >
                        Delete
                      </VscodeButton>
                    </div>
                  </VscodeTableCell>
                </VscodeTableRow>
              ))}
            </VscodeTableBody>
          </VscodeTable>
        )}
      </div>
    </BasePanel>
  );
};
