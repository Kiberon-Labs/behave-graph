import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';

import { useSystem } from '@/system/provider';
import type { SpecificRenderProps } from '@/store/specific';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

const NAME = 'variable/set.variableId';

export function getVariableSetSpecific() {
  return {
    name: NAME,
    check: (spec: NodeSpecJSON) => spec?.type === 'variable/set',
    render: VariableSetSpecific
  };
}

const VariableSetSpecific: React.FC<SpecificRenderProps> = ({ node }) => {
  const system = useSystem();
  const variables = useStore(system.variableStore, (s) => s.variables);

  const options = useMemo(() => {
    return Object.entries(variables).map(([id, variable]) => ({
      id,
      name: variable.name,
      valueType: variable.valueTypeName
    }));
  }, [variables]);

  const value = useMemo(() => {
    const v = node.data.configuration?.variableId;
    return v === undefined || v === null ? '' : String(v);
  }, [node.data]);

  const setNodeConfigValue = useCallback(
    (nextValue: string) => {
      const selectedVariable = variables[nextValue];
      if (!selectedVariable) return;

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n: any) => {
          if (n.id !== node.id) return n;

          // Update configuration and ports with the selected variable
          const updatedNode = {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data?.configuration,
                variableId: nextValue
              },
              dynamicPorts: {
                ...n.data?.dynamicPorts,
                inputs: [
                  {
                    name: 'value',
                    key: 'value',
                    valueType: selectedVariable.valueTypeName
                  }
                ]
              }
            }
          };

          return updatedNode;
        })
      );
    },
    [node.id, system, variables]
  );

  useEffect(() => {
    if (value || options.length === 0) return;
    const first = options[0];
    if (!first) return;
    setNodeConfigValue(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, node.id]);

  return (
    <div style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
        Variable
      </div>
      <VscodeSingleSelect
        style={{ width: '200px' }}
        value={value}
        onChange={(e: any) =>
          setNodeConfigValue(String(e?.target?.value ?? ''))
        }
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <VscodeOption value="">No variables</VscodeOption>
        ) : (
          options.map((opt) => (
            <VscodeOption key={opt.id} value={opt.id}>
              {opt.name} ({opt.valueType})
            </VscodeOption>
          ))
        )}
      </VscodeSingleSelect>
    </div>
  );
};
