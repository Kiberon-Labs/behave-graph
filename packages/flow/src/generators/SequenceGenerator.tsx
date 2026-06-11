import React, { useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { Plus, Minus } from 'iconoir-react';

import { useSystem } from '@/system/provider';
import type { SocketGeneratorRenderProps } from '@/store/socketGenerator';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph/Graphs/IO/NodeSpecJSON';

const NAME = 'flow/sequence.socketGenerator';

export function getSequenceGenerator() {
  return {
    name: NAME,
    check: (spec: NodeSpecJSON) =>
      (spec as { type?: string })?.type === 'flow/sequence',
    render: SequenceGenerator
  };
}

const SequenceGenerator: React.FC<SocketGeneratorRenderProps> = ({ node }) => {
  const system = useSystem();

  const numOutputs = node.data.configuration?.numOutputs ?? 0;

  const updateNumOutputs = useCallback(
    (newNumOutputs: number) => {
      if (newNumOutputs < 1) return;

      const outputs: { name: string; key: string; valueType: string }[] = [];
      for (let i = 1; i <= newNumOutputs; i++) {
        outputs.push({
          name: `${i}`,
          key: `${i}`,
          valueType: 'flow'
        });
      }

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data.configuration,
                numOutputs: newNumOutputs
              },
              dynamicPorts: {
                ...n.data.dynamicPorts,
                outputs
              }
            }
          };
        })
      );
    },
    [node.id, system]
  );

  const addOutput = useCallback(() => {
    updateNumOutputs(numOutputs + 1);
  }, [numOutputs, updateNumOutputs]);

  const removeOutput = useCallback(() => {
    updateNumOutputs(Math.max(1, numOutputs - 1));
  }, [numOutputs, updateNumOutputs]);

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
        <div style={{ fontSize: 12, opacity: 0.9 }}>Outputs: {numOutputs}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <VscodeButton onClick={addOutput} title="Add Output" iconOnly>
          <Plus />
        </VscodeButton>
        <VscodeButton
          onClick={removeOutput}
          secondary
          iconOnly
          title="Remove Output"
          disabled={numOutputs === 1}
        >
          <Minus />
        </VscodeButton>
      </div>
    </div>
  );
};
