import React, { useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Variable } from '@kiberon-labs/behave-graph';
import { useActiveGraph } from '@/system/provider';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption,
  VscodeLabel
} from '@vscode-elements/react-elements';
import styles from './styles.module.css';

type Props = {
  onBack: () => void;
  onCancel: () => void;
  onCreated?: (variableKey: string) => void;
};

export function CreateVariableScreen({ onBack, onCancel, onCreated }: Props) {
  const system = useActiveGraph()!;
  const registry = useStore(system.editor.registry);
  const setVariable = useStore(system.variableStore, (x) => x.setVariable);
  const controls = useStore(system.controlStore, (x) => x.controls);
  const defaultControl = useStore(system.controlStore, (x) => x.defaultControl);

  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('string');
  const [newVarInitialValue, setNewVarInitialValue] = useState<any>('');

  const availableTypes = useMemo(() => {
    return Object.keys(registry.values).sort();
  }, [registry.values]);

  const getControlComponent = useCallback(
    (valueType: string) => {
      return controls[valueType] || defaultControl;
    },
    [controls, defaultControl]
  );

  const NewVarControlComponent = useMemo(() => {
    return getControlComponent(newVarType);
  }, [getControlComponent, newVarType]);

  const resetForm = useCallback(() => {
    setNewVarName('');
    const valueType = registry.values[newVarType];
    if (valueType) {
      setNewVarInitialValue(valueType.creator());
    }
  }, [registry.values, newVarType]);

  const handleCreate = useCallback(() => {
    if (!newVarName.trim()) return;

    const valueType = registry.values[newVarType];
    if (!valueType) {
      console.error(`Value type ${newVarType} not found in registry`);
      return;
    }

    const newVariable = new Variable(
      newVarName,
      newVarName,
      newVarType,
      newVarInitialValue
    );

    setVariable(newVarName, newVariable);
    onCreated?.(newVarName);
    resetForm();
    onBack();
  }, [
    newVarName,
    newVarType,
    newVarInitialValue,
    registry.values,
    setVariable,
    onCreated,
    resetForm,
    onBack
  ]);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

  const handleBack = useCallback(() => {
    resetForm();
    onBack();
  }, [resetForm, onBack]);

  return (
    <>
      <div className={styles.headerRow}>
        <h3
          style={{
            fontSize: '1.1em',
            fontWeight: 'bold'
          }}
        >
          Create Variable
        </h3>

        <VscodeButton secondary onClick={handleBack}>
          Back
        </VscodeButton>
      </div>

      <div className={`${styles.section} ${styles.sectionPadded}`}>
        <div className={styles.field}>
          <VscodeLabel>Name:</VscodeLabel>
          <VscodeTextfield
            value={newVarName}
            placeholder="Variable name..."
            onChange={(e: any) => setNewVarName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <VscodeLabel>Type:</VscodeLabel>
          <VscodeSingleSelect
            value={newVarType}
            onChange={(e: any) => {
              const valueType = registry.values[e.target.value];
              if (valueType?.serialize && valueType?.creator) {
                setNewVarInitialValue(valueType.serialize(valueType.creator()));
              }
              setNewVarType(e.target.value);
            }}
          >
            {availableTypes.map((type) => (
              <VscodeOption key={type} value={type}>
                {type}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        </div>

        <div className={styles.field}>
          <VscodeLabel>Initial Value:</VscodeLabel>
          <NewVarControlComponent
            value={newVarInitialValue}
            onChange={setNewVarInitialValue}
            valueType={newVarType}
          />
        </div>

        <div className={styles.actionsRow}>
          <VscodeButton onClick={handleCreate} disabled={!newVarName.trim()}>
            Save
          </VscodeButton>
          <VscodeButton secondary onClick={handleCancel}>
            Cancel
          </VscodeButton>
        </div>
      </div>
    </>
  );
}
