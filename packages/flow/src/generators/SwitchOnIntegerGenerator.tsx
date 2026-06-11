import React, { useCallback, useState } from 'react';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption
} from '@vscode-elements/react-elements';
import { Plus, Minus } from 'iconoir-react';

import { useSystem } from '@/system/provider';
import type { SocketGeneratorRenderProps } from '@/store/socketGenerator';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph/Graphs/IO/NodeSpecJSON';

const NAME = 'flow/switch/integer.socketGenerator';

export function getSwitchOnIntegerGenerator() {
  return {
    name: NAME,
    check: (spec: NodeSpecJSON) => spec?.type === 'flow/switch/integer',
    render: SwitchOnIntegerGenerator
  };
}

const SwitchOnIntegerGenerator: React.FC<SocketGeneratorRenderProps> = ({
  node
}) => {
  const system = useSystem();

  const numCases = node.data.configuration?.numCases ?? 0;
  const caseLabels = node.data.configuration?.caseLabels ?? {};
  const caseValues = node.data.configuration?.cases ?? {};

  const [selectedCase, setSelectedCase] = useState<number>(1);

  const updateNumCases = useCallback(
    (newNumCases: number) => {
      if (newNumCases < 0) return;

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;

          // Preserve existing case values when changing numCases
          const existingCases = n.data?.configuration?.cases ?? {};
          const newCases: Record<string, bigint> = {};
          for (let i = 1; i <= newNumCases; i++) {
            const key = `${i}`;
            newCases[key] = existingCases[key] ?? BigInt(i);
          }

          // Generate input sockets for each case
          const inputs = [];
          for (let i = 1; i <= newNumCases; i++) {
            const key = `${i}`;
            inputs.push({
              name: n.data.configuration?.caseLabels?.[key] || key,
              key,
              valueType: 'integer'
            });
          }

          // Generate output sockets for each case
          const outputs = [];
          for (let i = 1; i <= newNumCases; i++) {
            const label = n.data.configuration?.caseLabels?.[`${i}`] || `${i}`;
            outputs.push({
              name: label,
              key: `${i}`,
              valueType: 'flow'
            });
          }
          // Add default output
          outputs.push({
            name: 'default',
            key: 'default',
            valueType: 'flow'
          });

          return {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data.configuration,
                numCases: newNumCases,
                cases: newCases
              },
              dynamicPorts: {
                ...n.data.dynamicPorts,
                inputs,
                outputs
              }
            }
          };
        })
      );

      if (selectedCase > newNumCases && newNumCases > 0) {
        setSelectedCase(newNumCases);
      }
    },
    [node.id, system, selectedCase]
  );

  const updateCaseValue = useCallback(
    (caseIndex: number, value: string) => {
      const intValue =
        value === ''
          ? BigInt(caseIndex)
          : BigInt(parseInt(value, 10) || caseIndex);
      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n: any) => {
          if (n.id !== node.id) return n;

          const updatedCases = {
            ...n.data?.configuration?.cases,
            [`${caseIndex}`]: intValue
          };

          const updatedLabels = {
            ...n.data?.configuration?.caseLabels,
            [`${caseIndex}`]: value || `${caseIndex}`
          };

          // Update input sockets
          const numCases = n.data?.configuration?.numCases ?? 0;
          const inputs = [];
          for (let i = 1; i <= numCases; i++) {
            const key = `${i}`;
            inputs.push({
              name: updatedLabels[key] || key,
              key,
              valueType: 'integer'
            });
          }

          // Regenerate output sockets with updated labels
          const outputs = [];
          for (let i = 1; i <= numCases; i++) {
            const label = updatedLabels[`${i}`] || `${i}`;
            outputs.push({
              name: label,
              key: `${i}`,
              valueType: 'flow'
            });
          }
          outputs.push({
            name: 'default',
            key: 'default',
            valueType: 'flow'
          });

          return {
            ...n,
            data: {
              ...n.data,
              dynamicPorts: {
                ...n.data?.dynamicPorts,
                inputs,
                outputs
              },
              configuration: {
                ...n.data?.configuration,
                cases: updatedCases,
                caseLabels: updatedLabels
              }
            }
          };
        })
      );
    },
    [node.id, system]
  );

  const addCase = useCallback(() => {
    const newCount = numCases + 1;
    updateNumCases(newCount);
    setSelectedCase(newCount);
  }, [numCases, updateNumCases]);

  const removeCase = useCallback(() => {
    updateNumCases(Math.max(0, numCases - 1));
  }, [numCases, updateNumCases]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.9 }}>Cases: {numCases}</div>
      </div>

      {numCases > 0 && (
        <>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: -4 }}>
            Edit Case
          </div>
          <VscodeSingleSelect
            value={String(selectedCase)}
            onChange={(e: any) => setSelectedCase(Number(e.target.value))}
          >
            {Array.from({ length: numCases }, (_, i) => i + 1).map(
              (caseIndex) => (
                <VscodeOption key={caseIndex} value={String(caseIndex)}>
                  {caseLabels[`${caseIndex}`] || `Case ${caseIndex}`}
                </VscodeOption>
              )
            )}
          </VscodeSingleSelect>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, opacity: 0.8 }}>Match Value</label>
            <VscodeTextfield
              type="number"
              value={
                caseValues[`${selectedCase}`] !== undefined
                  ? String(caseValues[`${selectedCase}`])
                  : ''
              }
              onInput={(e: any) =>
                updateCaseValue(selectedCase, e.target.value)
              }
              placeholder={`Integer value for case ${selectedCase}`}
            />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <VscodeButton onClick={addCase} title="Add Case" iconOnly>
          <Plus />
        </VscodeButton>
        <VscodeButton
          onClick={removeCase}
          secondary
          iconOnly
          title="Remove Case"
          disabled={numCases === 0}
        >
          <Minus />
        </VscodeButton>
      </div>
    </div>
  );
};
