import React, { useMemo } from 'react';
import { useSystem } from '@/system/provider';
import {
  VscodeButton,
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow
} from '@vscode-elements/react-elements';
import { BasePanel } from '../base';
import styles from './index.module.css';

export const PanelPanel = () => {
  const system = useSystem();

  // Get all registered panels from the TabLoader
  const registeredPanels = useMemo(() => {
    const panels = Object.keys(system.tabLoader.tabs).map((id) => {
      const tabData = system.tabLoader.tabs[id]?.();
      return {
        id,
        title: tabData?.title || id,
        group: tabData?.group || 'default',
        closable: tabData?.closable ?? true,
        cached: tabData?.cached ?? false
      };
    });

    // Sort by title for easier browsing
    return panels.sort((a, b) => a.title.localeCompare(b.title));
  }, [system.tabLoader.tabs]);

  const handleOpenPanel = (panelId: string) => {
    system.tabStore.getState().openTab(panelId);
  };

  return (
    <BasePanel>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Registered Panels</h2>
          <div className={styles.count}>{registeredPanels.length} panels</div>
        </div>

        <VscodeTable className={styles.table}>
          <VscodeTableHeader slot="header">
            <VscodeTableHeaderCell>Panel</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>ID</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Group</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Options</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Action</VscodeTableHeaderCell>
          </VscodeTableHeader>
          <VscodeTableBody slot="body">
            {registeredPanels.map((panel) => (
              <VscodeTableRow key={panel.id}>
                <VscodeTableCell className={styles.titleCell}>
                  {panel.title}
                </VscodeTableCell>
                <VscodeTableCell className={styles.idCell}>
                  <code>{panel.id}</code>
                </VscodeTableCell>
                <VscodeTableCell className={styles.groupCell}>
                  {panel.group}
                </VscodeTableCell>
                <VscodeTableCell className={styles.optionsCell}>
                  {panel.cached && <span className={styles.badge}>cached</span>}
                  {!panel.closable && (
                    <span className={styles.badge}>not closable</span>
                  )}
                </VscodeTableCell>
                <VscodeTableCell className={styles.actionCell}>
                  <VscodeButton
                    onClick={() => handleOpenPanel(panel.id)}
                    secondary
                  >
                    Open
                  </VscodeButton>
                </VscodeTableCell>
              </VscodeTableRow>
            ))}
          </VscodeTableBody>
        </VscodeTable>
      </div>
    </BasePanel>
  );
};
