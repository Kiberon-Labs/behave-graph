import { useSystem } from '@/system/provider';
import {
  VscodeButton,
  VscodeLabel,
  VscodeTextfield,
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow
} from '@vscode-elements/react-elements';
import { useState } from 'react';
import { useStore } from 'zustand';
import styles from './index.module.css';
import { BasePanel } from '../base';

export const KeymapsPanel = () => {
  const system = useSystem();
  const keymap = useStore(system.hotKeyStore, (s) => s.keymap);
  const descriptions = useStore(system.hotKeyStore, (s) => s.descriptions);
  const register = useStore(system.hotKeyStore, (s) => s.register);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (action: string) => {
    const current = keymap[action];
    setEditingKey(action);
    setEditValue(Array.isArray(current) ? current.join(', ') : current || '');
  };

  const handleSave = (action: string) => {
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      // Parse the input - if it contains commas, treat as array
      const newValue = trimmedValue.includes(',')
        ? trimmedValue
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        : trimmedValue;

      register({
        action,
        trigger: newValue
      });
    }
    setEditingKey(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleReset = (action: string) => {
    // Reset to default - you might want to store defaults separately
    // For now, this just clears the binding
    const confirmed = confirm(`Reset keybinding for ${action}?`);
    if (confirmed) {
      register({
        action,
        trigger: ''
      });
      setEditingKey(null);
    }
  };

  const formatKeymap = (value: string | string[] | undefined): string => {
    if (!value) {
      return 'Not set';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value;
  };

  const getDescription = (action: string): string => {
    return descriptions[action] || action;
  };

  // Get all actions from keymap
  const actions = Object.keys(keymap).sort();

  return (
    <BasePanel>
      <div className={styles.content}>
        <div className={styles.header}>
          <VscodeLabel>Keyboard Shortcuts</VscodeLabel>
          <span className={styles.helpText}>
            Customize keyboard shortcuts for various actions. Use commas to
            separate multiple key combinations.
          </span>
        </div>

        <VscodeTable className={styles.table} zebra>
          <VscodeTableHeader slot="header">
            <VscodeTableHeaderCell>Command</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Key Binding</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Actions</VscodeTableHeaderCell>
          </VscodeTableHeader>
          <VscodeTableBody slot="body">
            {actions.map((action) => (
              <VscodeTableRow key={action}>
                <VscodeTableCell className={styles.actionCell}>
                  <div className={styles.actionInfo}>
                    <div className={styles.actionLabel}>
                      {getDescription(action)}
                    </div>
                    <code className={styles.actionId}>{action}</code>
                  </div>
                </VscodeTableCell>

                <VscodeTableCell className={styles.keybindingCell}>
                  {editingKey === action ? (
                    <VscodeTextfield
                      value={editValue}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        setEditValue(target.value);
                      }}
                      placeholder="e.g., ctrl+k or ctrl+k, command+k"
                      className={styles.textfield}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSave(action);
                        } else if (e.key === 'Escape') {
                          handleCancel();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.keyBadge}>
                      {formatKeymap(keymap[action])}
                    </span>
                  )}
                </VscodeTableCell>

                <VscodeTableCell className={styles.actionsCell}>
                  {editingKey === action ? (
                    <div className={styles.buttonGroup}>
                      <VscodeButton onClick={() => handleSave(action)}>
                        Save
                      </VscodeButton>
                      <VscodeButton onClick={handleCancel}>Cancel</VscodeButton>
                      <VscodeButton onClick={() => handleReset(action)}>
                        Reset
                      </VscodeButton>
                    </div>
                  ) : (
                    <VscodeButton onClick={() => handleEdit(action)}>
                      Edit
                    </VscodeButton>
                  )}
                </VscodeTableCell>
              </VscodeTableRow>
            ))}
          </VscodeTableBody>
        </VscodeTable>
      </div>
    </BasePanel>
  );
};
