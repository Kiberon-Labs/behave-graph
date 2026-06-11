import React, { useState, useCallback } from 'react';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { CreateVariableScreen } from './CreateVariableScreen';
import { ManageVariablesScreen } from './ManageVariablesScreen';
import { BasePanel } from '../base';

type VariablesPanelScreen = 'manage' | 'create';

export function VariablesPanel() {
  const system = useSystem();
  const variables = useStore(system.variableStore, (x) => x.variables);
  const setVariable = useStore(system.variableStore, (x) => x.setVariable);
  const removeVariable = useStore(
    system.variableStore,
    (x) => x.removeVariable
  );
  const controls = useStore(system.controlStore, (x) => x.controls);
  const defaultControl = useStore(system.controlStore, (x) => x.defaultControl);

  // Get the appropriate control component for a value type
  const getControlComponent = useCallback(
    (valueType: string) => {
      return controls[valueType] || defaultControl;
    },
    [controls, defaultControl]
  );

  const [screen, setScreen] = useState<VariablesPanelScreen>('manage');

  // Section 2 & 3: Select and edit existing variable
  const [selectedVarId, setSelectedVarId] = useState<string>('');
  const [editValue, setEditValue] = useState<any>('');

  // Handle selecting a variable
  const handleSelectVariable = useCallback(
    (varKey: string) => {
      setSelectedVarId(varKey);
      const variable = variables[varKey];

      if (variable) {
        setEditValue(variable.initialValue);
      }
    },
    [variables]
  );

  // Handle updating selected variable
  const handleUpdateVariable = useCallback(() => {
    if (!selectedVarId || !variables[selectedVarId]) {
      return;
    }

    const variable = variables[selectedVarId];
    // Force re-render by updating the store
    setVariable(selectedVarId, {
      ...variable,
      initialValue: editValue
    });
  }, [selectedVarId, editValue, variables, setVariable]);

  // Handle deleting a variable
  const handleDeleteVariable = useCallback(
    (varName: string) => {
      removeVariable(varName);
      if (varName === selectedVarId) {
        setSelectedVarId('');
        setEditValue('');
      }
    },
    [removeVariable, selectedVarId, variables]
  );

  const selectedVariable = selectedVarId
    ? (variables[selectedVarId] ?? null)
    : null;
  const SelectedVarControlComponent = selectedVariable
    ? getControlComponent(selectedVariable.valueTypeName)
    : defaultControl;

  const goToCreate = useCallback(() => {
    setScreen('create');
  }, []);

  const goToManage = useCallback(() => {
    setScreen('manage');
  }, []);

  const handleCreatedVariable = useCallback(
    (variableKey: string) => {
      setSelectedVarId(variableKey);
      const created = system.variableStore.getState().variables[variableKey];
      if (created) {
        setEditValue(created.initialValue);
      }
    },
    [system.variableStore]
  );

  return (
    <BasePanel>
      {screen === 'create' && (
        <CreateVariableScreen
          onBack={goToManage}
          onCancel={goToManage}
          onCreated={handleCreatedVariable}
        />
      )}
      {screen === 'manage' && (
        <ManageVariablesScreen
          variables={variables}
          selectedVarKey={selectedVarId}
          onSelectVariable={handleSelectVariable}
          onDeleteVariable={handleDeleteVariable}
          onNewVariable={goToCreate}
          selectedVariable={selectedVariable}
          editValue={editValue}
          onChangeEditValue={setEditValue}
          SelectedVarControlComponent={SelectedVarControlComponent}
          onUpdateVariable={handleUpdateVariable}
        />
      )}
    </BasePanel>
  );
}
