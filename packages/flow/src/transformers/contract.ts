import type { Node } from 'reactflow';
import type { GraphSocketJSON } from '@kiberon-labs/behave-graph';
import type { Socket } from '@/types';

export const GRAPH_INPUT_TYPE = 'graph/input';
export const GRAPH_OUTPUT_TYPE = 'graph/output';
export const CALL_SUBGRAPH_TYPE = 'flow/callSubgraph';

export type ContractParam = {
  /** Stable identifier (socket key / contract key). Independent of the name. */
  id?: string;
  /** User-facing display name; editable without breaking wiring. */
  name: string;
  valueTypeName: string;
  defaultValue?: any;
};

export type GraphContract = {
  graphInputs: GraphSocketJSON[];
  graphOutputs: GraphSocketJSON[];
};

/** Stable identity of a param , its id, falling back to name for legacy data. */
export const paramId = (param: ContractParam): string => param.id ?? param.name;

const readParams = (node: Node): ContractParam[] => {
  const params = (node.data as any)?.configuration?.parameters;
  return Array.isArray(params) ? (params as ContractParam[]) : [];
};

const toSocket = (param: ContractParam): GraphSocketJSON => ({
  key: paramId(param),
  valueType: param.valueTypeName,
  ...(param.defaultValue !== undefined
    ? { defaultValue: param.defaultValue }
    : {}),
  label: param.name
});

/**
 * Derive a graph's contract from its boundary nodes. The `graph/input` /
 * `graph/output` nodes are the source of truth; their configured parameters
 * become the graph's `graphInputs` / `graphOutputs`.
 */
export const deriveContract = (nodes: Node[]): GraphContract => {
  const graphInputs: GraphSocketJSON[] = [];
  const graphOutputs: GraphSocketJSON[] = [];

  for (const node of nodes) {
    const type = (node.data as any)?.type;
    if (type === GRAPH_INPUT_TYPE) {
      graphInputs.push(...readParams(node).map(toSocket));
    } else if (type === GRAPH_OUTPUT_TYPE) {
      graphOutputs.push(...readParams(node).map(toSocket));
    }
  }

  return { graphInputs, graphOutputs };
};

/**
 * Convert a derived contract's sockets back into editable {@link ContractParam}s
 * , the form stored in a Call Subgraph node's configuration. The socket `key`
 * is the stable param id; its `label` is the display name.
 */
export const contractToParams = (sockets: GraphSocketJSON[]): ContractParam[] =>
  sockets.map((s) => ({
    id: s.key,
    name: s.label ?? s.key,
    valueTypeName: s.valueType,
    ...(s.defaultValue !== undefined ? { defaultValue: s.defaultValue } : {})
  }));

/**
 * Convert contract params into dynamic-port sockets. The socket identity
 * (name/key/handle id) is the stable param id; the display label is the name.
 */
export const paramsToSockets = (params: ContractParam[]): Socket[] =>
  params.map((p) => {
    const id = paramId(p);
    return {
      name: id,
      key: id,
      label: p.name || id,
      valueType: p.valueTypeName || 'string'
    };
  });
