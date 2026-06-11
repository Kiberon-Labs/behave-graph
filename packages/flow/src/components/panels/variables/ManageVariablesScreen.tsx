import React from 'react';
import type { VariableJSON } from '@kiberon-labs/behave-graph';
import {
  VscodeButton,
  VscodeDivider,
  VscodeTree,
  VscodeTreeItem
} from '@vscode-elements/react-elements';
import { Plus, TrashSolid } from 'iconoir-react';
import styles from './styles.module.css';
import { useSystem } from '@/system';
import { useStore } from 'zustand';
import { Icon } from '@/components/primitives/icon';

type ValueControlProps = {
  value: any;
  onChange: (value: any) => void;
  valueType: string;
};

type Props = {
  variables: Record<string, VariableJSON>;
  selectedVarKey: string;
  onSelectVariable: (key: string) => void;
  onDeleteVariable: (key: string) => void;
  onNewVariable: () => void;

  selectedVariable: VariableJSON | null;
  editValue: any;
  onChangeEditValue: (value: any) => void;
  SelectedVarControlComponent: React.ComponentType<ValueControlProps>;
  onUpdateVariable: () => void;
};

export function ManageVariablesScreen({
  selectedVarKey: _selectedVarKey,
  onSelectVariable,
  onDeleteVariable,
  onNewVariable,
  selectedVariable,
  editValue,
  onChangeEditValue,
  SelectedVarControlComponent,
  onUpdateVariable
}: Props) {
  const system = useSystem();
  const icons = useStore(system.legendStore, (x) => x.icons);
  const variables = useStore(system.variableStore, (x) => x.variables);

  const handleTreeSelect = (ev: unknown) => {
    const detail = (ev as CustomEvent<any>)?.detail;
    const selectedItems = Array.isArray(detail)
      ? detail
      : detail?.selectedItems;
    const firstSelected = selectedItems?.[0] as HTMLElement | undefined;
    const key = firstSelected?.dataset?.varKey;

    if (key) {
      onSelectVariable(key);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>Variables</div>
        <Icon title="New variable" onClick={onNewVariable}>
          <Plus />
        </Icon>
      </div>
      <VscodeDivider />

      <div className={styles.variableList}>
        {Object.keys(variables).length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateText}>No variables defined</div>
            <div className={styles.emptyStateHint}>
              Click the "+" button to create your first variable
            </div>
          </div>
        ) : (
          <VscodeTree
            className={styles.tree}
            onVscTreeSelect={handleTreeSelect}
          >
            {Object.entries(variables).map(([name, variable]) => (
              <VscodeTreeItem
                key={name}
                data-var-key={name}
                active={variable.id == selectedVariable?.id}
              >
                <div className={styles.treeItemContent}>
                  <div className={styles.treeItemIcon}>
                    {icons[variable.valueTypeName] &&
                      React.createElement(icons[variable.valueTypeName]!)}
                  </div>
                  <div className={styles.treeItemInfo} title={variable.id}>
                    {variable.name}
                  </div>
                </div>
              </VscodeTreeItem>
            ))}
          </VscodeTree>
        )}
      </div>

      {selectedVariable && (
        <div className={styles.selectedEditor}>
          <div className={styles.editorHeader}>
            <div className={styles.editorTitle}>Edit Variable</div>
            <div className={styles.editorVariableName}>
              {selectedVariable.name}
            </div>
          </div>

          <div className={styles.editorFields}>
            <label className={styles.fieldLabel}>Current Value</label>
            <div className={styles.fieldControl}>
              <SelectedVarControlComponent
                value={editValue}
                onChange={onChangeEditValue}
                valueType={selectedVariable.valueTypeName}
              />
            </div>
          </div>

          <div className={styles.editorActions}>
            <VscodeButton
              secondary
              iconOnly
              title="Delete variable"
              onClick={() => {
                onDeleteVariable(selectedVariable.name);
              }}
            >
              <TrashSolid />
            </VscodeButton>
            <VscodeButton onClick={onUpdateVariable}>Update Value</VscodeButton>
          </div>
        </div>
      )}
    </div>
  );
}
