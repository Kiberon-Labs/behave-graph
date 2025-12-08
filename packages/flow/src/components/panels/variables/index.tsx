import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { Variable } from '@kinforge/behave-graph';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption,
  VscodeLabel
} from '@vscode-elements/react-elements';
import { Plus, Trash } from 'iconoir-react';

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

  // Section 1: Define new variable
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('string');
  const [newVarInitialValue, setNewVarInitialValue] = useState<any>('');

  // Section 2 & 3: Select and edit existing variable
  const [selectedVarId, setSelectedVarId] = useState<string>('');
  const [editValue, setEditValue] = useState<any>('');

  // Available value types from the system registry
  const availableTypes = useMemo(() => {
    return Object.keys(system.registry.values).sort();
  }, [system.registry.values]);

  // Initialize the initial value with the creator when type changes
  useEffect(() => {
    const valueType = system.registry.values[newVarType];
    if (valueType) {
      setNewVarInitialValue(valueType.creator());
    }
  }, [newVarType, system.registry.values]);

  // Get the control component for the new variable type
  const NewVarControlComponent = useMemo(() => {
    return getControlComponent(newVarType);
  }, [newVarType, controls, defaultControl]);

  // Handle creating a new variable
  const handleCreateVariable = useCallback(() => {
    if (!newVarName.trim()) {
      return;
    }

    const valueType = system.registry.values[newVarType];
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

    // Reset form
    setNewVarName('');
    const resetValueType = system.registry.values[newVarType];
    if (resetValueType) {
      setNewVarInitialValue(resetValueType.creator());
    }
  }, [
    newVarName,
    newVarType,
    newVarInitialValue,
    setVariable,
    system.registry.values
  ]);

  // Handle selecting a variable
  const handleSelectVariable = useCallback(
    (varId: string) => {
      setSelectedVarId(varId);
      const variable = variables[varId];
      if (variable) {
        setEditValue(variable.get());
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
    variable.set(editValue);
    // Force re-render by updating the store
    setVariable(variable.name, variable);
  }, [selectedVarId, editValue, variables, setVariable]);

  // Handle deleting a variable
  const handleDeleteVariable = useCallback(
    (varName: string) => {
      removeVariable(varName);
      if (variables[varName]?.id === selectedVarId) {
        setSelectedVarId('');
        setEditValue('');
      }
    },
    [removeVariable, selectedVarId, variables]
  );

  const selectedVariable = selectedVarId ? variables[selectedVarId] : null;
  const SelectedVarControlComponent = selectedVariable
    ? getControlComponent(selectedVariable.valueTypeName)
    : defaultControl;

  return (
    <div className="flex flex-col gap-2 h-100 flex-1 p-2">
      {/* Section 1: Define New Variable */}
      <div className="flex flex-col gap-1 p-2">
        <h3
          style={{
            fontSize: '1.1em',
            fontWeight: 'bold'
          }}
        >
          Define New Variable
        </h3>

        <div className="flex flex-col gap-1">
          <VscodeLabel>Name:</VscodeLabel>
          <VscodeTextfield
            value={newVarName}
            placeholder="Variable name..."
            onChange={(e: any) => setNewVarName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <VscodeLabel>Type:</VscodeLabel>
          <VscodeSingleSelect
            value={newVarType}
            onChange={(e: any) => setNewVarType(e.target.value)}
          >
            {availableTypes.map((type) => (
              <VscodeOption key={type} value={type}>
                {type}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        </div>

        <div className="flex flex-col gap-1">
          <VscodeLabel>Initial Value:</VscodeLabel>
          <NewVarControlComponent
            value={newVarInitialValue}
            onChange={setNewVarInitialValue}
            valueType={newVarType}
          />
        </div>

        <VscodeButton
          onClick={handleCreateVariable}
          disabled={!newVarName.trim()}
        >
          <Plus style={{ marginRight: '4px' }} />
          Create Variable
        </VscodeButton>
      </div>

      {/* Section 2: Select Existing Variable */}
      <div className="flex-col gap-1 p-2">
        <h3
          style={{
            fontSize: '1.1em',
            fontWeight: 'bold'
          }}
        >
          Select Variable
        </h3>

        {Object.keys(variables).length === 0 ? (
          <div style={{ fontSize: '0.9em', fontStyle: 'italic', opacity: 0.7 }}>
            No variables defined yet
          </div>
        ) : (
          <div className="flex-col gap-1">
            {Object.entries(variables).map(([name, variable]) => (
              <div
                key={variable.id}
                className="flex gap-1 items-center p-1"
                style={{
                  border:
                    selectedVarId === variable.id
                      ? '2px solid var(--vscode-focusBorder)'
                      : '1px solid var(--color-neutral-stroke-subtle)',

                  cursor: 'pointer',
                  backgroundColor:
                    selectedVarId === variable.id
                      ? 'var(--vscode-list-activeSelectionBackground)'
                      : 'transparent'
                }}
                onClick={() => handleSelectVariable(variable.id)}
              >
                <div className="flex-1">
                  <div style={{ fontWeight: 'bold' }}>{variable.name}</div>
                  <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                    {variable.valueTypeName} = {variable.get()?.toString()}
                  </div>
                </div>
                <VscodeButton
                  secondary
                  iconOnly
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleDeleteVariable(name);
                  }}
                >
                  <Trash />
                </VscodeButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Update Selected Variable */}
      {selectedVariable && (
        <div
          className="flex-col gap-1 p-2"
          style={{
            border: '1px solid var(--color-neutral-stroke-subtle)',
            borderRadius: 'var(--component-spacing-xs)'
          }}
        >
          <h3
            style={{
              fontSize: '1.1em',
              fontWeight: 'bold',
              marginBottom: 'var(--component-spacing-xs)'
            }}
          >
            Update Variable: {selectedVariable.name}
          </h3>

          <div className="flex flex-col gap-1">
            <label style={{ fontSize: '0.9em' }}>
              Type:{' '}
              <span style={{ fontWeight: 'bold' }}>
                {selectedVariable.valueTypeName}
              </span>
            </label>
            <label style={{ fontSize: '0.9em' }}>Current Value:</label>
            <SelectedVarControlComponent
              value={editValue}
              onChange={setEditValue}
              valueType={selectedVariable.valueTypeName}
            />
          </div>

          <VscodeButton onClick={handleUpdateVariable}>
            Update Value
          </VscodeButton>
        </div>
      )}
    </div>
  );
}
