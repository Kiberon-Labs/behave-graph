import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';
import { useGraph } from '@/system/provider';
import type { SocketGeneratorRenderProps } from '@/store/socketGenerator';
import type { Socket } from '@/types';
import type { IBehaveNode } from '@/types/nodes.js';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph/Graphs/IO/NodeSpecJSON';
import {
  CALL_SUBGRAPH_TYPE,
  contractToParams,
  deriveContract,
  paramsToSockets,
  type ContractParam
} from '@/transformers/contract';

export function getCallSubgraphGenerator() {
  return {
    name: `${CALL_SUBGRAPH_TYPE}.socketGenerator`,
    check: (spec: NodeSpecJSON) => spec?.type === CALL_SUBGRAPH_TYPE,
    render: CallSubgraphGenerator
  };
}

const toSockets = (params: ContractParam[] | undefined): Socket[] =>
  paramsToSockets(params ?? []);

/**
 * Properties-panel editor for a Call Subgraph node: pick which open graph to
 * call. Selecting one copies that graph's contract into the node configuration
 * and mirrors it onto the node's dynamic input/output ports. The `flow` input
 * and the `started` / `completed` flow outputs are static on the core node.
 */
const CallSubgraphGenerator: React.FC<SocketGeneratorRenderProps> = ({
  node
}) => {
  const session = useGraph();
  const sessions = useStore(session.editor.activeGraph, (s) => s.sessions);

  const options = useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => s.id !== session.id)
        .map((s) => ({ id: s.id, name: s.name })),
    [sessions, session.id]
  );

  const config = node.data.configuration as
    | { subgraphId?: string; inputs?: ContractParam[]; outputs?: ContractParam[] }
    | undefined;
  const subgraphId = String(config?.subgraphId ?? '');
  const portsKey = JSON.stringify({
    inputs: config?.inputs ?? [],
    outputs: config?.outputs ?? []
  });

  // Mirror the copied contract onto dynamic ports.
  useEffect(() => {
    const inputs = toSockets(config?.inputs);
    const outputs = toSockets(config?.outputs);
    session.nodeStore.getState().setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            dynamicPorts: { ...n.data?.dynamicPorts, inputs, outputs }
          }
        } as IBehaveNode;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portsKey, node.id, session.nodeStore]);

  const select = useCallback(
    (nextId: string) => {
      const target = sessions[nextId];
      const contract = target
        ? deriveContract(target.nodeStore.getState().nodes)
        : { graphInputs: [], graphOutputs: [] };
      const inputs = contractToParams(contract.graphInputs);
      const outputs = contractToParams(contract.graphOutputs);

      session.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data?.configuration,
                subgraphId: nextId,
                inputs,
                outputs
              }
            }
          } as IBehaveNode;
        })
      );
    },
    [node.id, session, sessions]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, opacity: 0.9 }}>Subgraph</div>
      <VscodeSingleSelect
        value={subgraphId}
        onChange={(e: any) => select(String(e?.target?.value ?? ''))}
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <VscodeOption value="">No other graphs open</VscodeOption>
        ) : (
          <>
            <VscodeOption value="">Select a graph...</VscodeOption>
            {options.map((opt) => (
              <VscodeOption key={opt.id} value={opt.id}>
                {opt.name || opt.id}
              </VscodeOption>
            ))}
          </>
        )}
      </VscodeSingleSelect>
    </div>
  );
};
