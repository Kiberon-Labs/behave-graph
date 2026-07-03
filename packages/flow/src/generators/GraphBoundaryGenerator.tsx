import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeOption,
  VscodeSingleSelect,
  VscodeTextfield
} from '@vscode-elements/react-elements';
import { Trash } from 'iconoir-react';
import { useGraph } from '@/system/provider';
import type { SocketGeneratorRenderProps } from '@/store/socketGenerator';
import type { Socket } from '@/types';
import type { IBehaveNode } from '@/types/nodes.js';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph/Graphs/IO/NodeSpecJSON';
import { v4 as uuidv4 } from 'uuid';
import {
  GRAPH_INPUT_TYPE,
  GRAPH_OUTPUT_TYPE,
  paramId,
  type ContractParam
} from '@/transformers/contract';
import styles from './GraphBoundaryGenerator.module.css';

type BoundaryKind = 'input' | 'output';

export function getGraphInputGenerator() {
  return {
    name: `${GRAPH_INPUT_TYPE}.socketGenerator`,
    check: (spec: NodeSpecJSON) => spec?.type === GRAPH_INPUT_TYPE,
    render: (props: SocketGeneratorRenderProps) => (
      <GraphBoundaryGenerator {...props} kind="input" />
    )
  };
}

export function getGraphOutputGenerator() {
  return {
    name: `${GRAPH_OUTPUT_TYPE}.socketGenerator`,
    check: (spec: NodeSpecJSON) => spec?.type === GRAPH_OUTPUT_TYPE,
    render: (props: SocketGeneratorRenderProps) => (
      <GraphBoundaryGenerator {...props} kind="output" />
    )
  };
}

/**
 * Properties-panel editor for a subgraph boundary node's contract: add / name /
 * type the inputs (`graph/input`) or outputs (`graph/output`). The configured
 * params are mirrored onto the node's dynamic ports , `graph/input` exposes them
 * as outputs, `graph/output` as inputs (the `flow` socket is static on the core
 * node).
 */
const GraphBoundaryGenerator: React.FC<
  SocketGeneratorRenderProps & { kind: BoundaryKind }
> = ({ node, kind }) => {
  const session = useGraph();
  // Select the stable `values` object then derive , a freshly built array inside
  // the selector would change identity every render and loop.
  const values = useStore(session.editor.registry, (s) => s.values);
  const valueTypes = useMemo(
    () => Object.keys(values).filter((t) => t !== 'flow'),
    [values]
  );

  const params: ContractParam[] = useMemo(
    () =>
      Array.isArray(node.data.configuration?.parameters)
        ? (node.data.configuration!.parameters as ContractParam[])
        : [],
    [node.data]
  );
  const paramsKey = JSON.stringify(params);

  // Mirror params onto dynamic ports. The socket identity (name/key/handle id)
  // is the stable param id; the display label is the editable name.
  useEffect(() => {
    const sockets: Socket[] = params.map((param) => {
      const id = paramId(param);
      return {
        name: id,
        key: id,
        label: param.name || id,
        valueType: param.valueTypeName || 'string'
      };
    });
    session.nodeStore.getState().setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            dynamicPorts: {
              ...n.data?.dynamicPorts,
              ...(kind === 'input' ? { outputs: sockets } : { inputs: sockets })
            }
          }
        } as IBehaveNode;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, kind, node.id, session.nodeStore]);

  const update = useCallback(
    (next: ContractParam[]) => {
      session.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              configuration: { ...n.data?.configuration, parameters: next }
            }
          } as IBehaveNode;
        })
      );
    },
    [node.id, session]
  );

  const addParam = useCallback(() => {
    const base = kind === 'input' ? 'in' : 'out';
    const existing = new Set(params.map((p) => p.name));
    let i = params.length + 1;
    let name = `${base}${i}`;
    while (existing.has(name)) name = `${base}${++i}`;
    update([
      ...params,
      { id: uuidv4(), name, valueTypeName: valueTypes[0] ?? 'string' }
    ]);
  }, [kind, params, update, valueTypes]);

  const setName = useCallback(
    (index: number, name: string) =>
      update(params.map((p, i) => (i === index ? { ...p, name } : p))),
    [params, update]
  );

  const setType = useCallback(
    (index: number, valueTypeName: string) =>
      update(params.map((p, i) => (i === index ? { ...p, valueTypeName } : p))),
    [params, update]
  );

  const remove = useCallback(
    (index: number) => update(params.filter((_, i) => i !== index)),
    [params, update]
  );

  return (
    <div className={styles.list}>
      {params.map((param, index) => (
        <div key={param.id ?? index} className={styles.param}>
          <div className={styles.topRow}>
            <VscodeTextfield
              className={styles.name}
              value={param.name}
              placeholder={`${kind} name`}
              onChange={(e: any) =>
                setName(index, String(e?.target?.value ?? ''))
              }
            />
            <VscodeButton
              secondary
              iconOnly
              title={`Remove ${kind}`}
              onClick={() => remove(index)}
            >
              <Trash />
            </VscodeButton>
          </div>
          <VscodeSingleSelect
            className={styles.type}
            value={param.valueTypeName}
            onChange={(e: any) =>
              setType(index, String(e?.target?.value ?? 'string'))
            }
          >
            {valueTypes.map((t) => (
              <VscodeOption key={t} value={t}>
                {t}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        </div>
      ))}
      <VscodeButton secondary onClick={addParam}>
        + Add {kind}
      </VscodeButton>
    </div>
  );
};
