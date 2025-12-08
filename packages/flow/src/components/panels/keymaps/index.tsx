import { useSystem } from '@/system/provider';
import {
  VscodeButton,
  VscodeLabel,
  VscodeTextfield
} from '@vscode-elements/react-elements';
import { useState } from 'react';
import { useStore } from 'zustand';

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

      register(action, newValue);
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
      register(action, '');
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
    <div
      className="h-full w-full flex-col flex-1 p-2"
      style={{
        overflow: 'auto'
      }}
    >
      <div className="flex-col gap-2">
        <div className="pb-2">
          <VscodeLabel>Keyboard Shortcuts</VscodeLabel>
          <span className="text-xs opacity-70">
            Customize keyboard shortcuts for various actions. Use commas to
            separate multiple key combinations.
          </span>
        </div>

        {actions.map((action) => (
          <div
            key={action}
            className="flex-col gap-1 p-2 border-b border-gray-700"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex-col flex-1">
                <VscodeLabel>{getDescription(action)}</VscodeLabel>
                <span className="text-xs opacity-60">{action}</span>
              </div>

              {editingKey !== action && (
                <div className="flex gap-1 items-center">
                  <span className="text-sm font-mono bg-gray-800 px-2 py-1 rounded">
                    {formatKeymap(keymap[action])}
                  </span>
                  <VscodeButton onClick={() => handleEdit(action)}>
                    Edit
                  </VscodeButton>
                </div>
              )}
            </div>

            {editingKey === action && (
              <div className="flex gap-1 mt-2 items-center">
                <VscodeTextfield
                  value={editValue}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement;
                    setEditValue(target.value);
                  }}
                  placeholder="e.g., ctrl+k or ctrl+k, command+k"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave(action);
                    } else if (e.key === 'Escape') {
                      handleCancel();
                    }
                  }}
                  autoFocus
                />
                <VscodeButton onClick={() => handleSave(action)}>
                  Save
                </VscodeButton>
                <VscodeButton onClick={handleCancel}>Cancel</VscodeButton>
                <VscodeButton onClick={() => handleReset(action)}>
                  Reset
                </VscodeButton>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
