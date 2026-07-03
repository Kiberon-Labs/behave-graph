import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { Connection, Edge, Node, XYPosition } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { getSocketsByNodeTypeAndHandleType } from './getSocketsByNodeTypeAndHandleType.js';
import { mergeSockets } from './mergeSockets.js';
import type { ConversionRule } from '@/store/conversions';
import type { IBehaveNode } from '@/types/nodes.js';

/**
 * Find a node spec that converts `sourceType` to `targetType` , a pure value
 * function with exactly one value input of the source type and one value output
 * of the target type, and no flow sockets (e.g. `math/toString/integer`).
 */
export const findConverterSpec = (
  specs: NodeSpecJSON[],
  sourceType: string,
  targetType: string
): NodeSpecJSON | undefined =>
  specs.find((spec) => {
    const valueIns = spec.inputs.filter((i) => i.valueType !== 'flow');
    const valueOuts = spec.outputs.filter((o) => o.valueType !== 'flow');
    const hasFlow =
      spec.inputs.some((i) => i.valueType === 'flow') ||
      spec.outputs.some((o) => o.valueType === 'flow');
    return (
      !hasFlow &&
      valueIns.length === 1 &&
      valueOuts.length === 1 &&
      valueIns[0]!.valueType === sourceType &&
      valueOuts[0]!.valueType === targetType
    );
  });

export type ResolvedConverter = {
  nodeType: string;
  inputName: string;
  outputName: string;
};

const firstValueSocketName = (
  sockets: { name: string; valueType: string }[]
): string | undefined => sockets.find((s) => s.valueType !== 'flow')?.name;

/**
 * Pick the socket that should carry a value of `valueType`: prefer one whose type
 * matches exactly (so multi-port converter nodes resolve the *right* port), then
 * fall back to the first non-flow socket for single-port nodes.
 */
const socketNameForType = (
  sockets: { name: string; valueType: string }[],
  valueType: string
): string | undefined =>
  sockets.find((s) => s.valueType === valueType)?.name ??
  firstValueSocketName(sockets);

/**
 * Resolve which converter to use for `from`→`to`. A registered
 * {@link ConversionRule} (e.g. from a custom profile) takes precedence; otherwise
 * fall back to scanning the specs for a generic single-in/single-out converter.
 *
 * A rule's `inputKey`/`outputKey` pin the exact ports to wire (required for
 * converter nodes with more than one input or output). When omitted they are
 * resolved by matching the port's value type to `from`/`to`.
 */
export const resolveConverter = (
  specs: NodeSpecJSON[],
  from: string,
  to: string,
  conversions?: ConversionRule[]
): ResolvedConverter | undefined => {
  const rule = conversions?.find((c) => c.from === from && c.to === to);
  if (rule) {
    const spec = specs.find((s) => s.type === rule.nodeType);
    const inputName =
      rule.inputKey ?? socketNameForType(spec?.inputs ?? [], from);
    const outputName =
      rule.outputKey ?? socketNameForType(spec?.outputs ?? [], to);
    if (inputName && outputName) {
      return { nodeType: rule.nodeType, inputName, outputName };
    }
    return undefined;
  }

  const spec = findConverterSpec(specs, from, to);
  if (!spec) return undefined;
  const inputName = firstValueSocketName(spec.inputs);
  const outputName = firstValueSocketName(spec.outputs);
  if (!inputName || !outputName) return undefined;
  return { nodeType: spec.type, inputName, outputName };
};

/** Resolve a node socket's value type (spec sockets merged with dynamic ports). */
export const getSocketValueType = (
  node: IBehaveNode,
  handleId: string | null | undefined,
  handleType: 'source' | 'target',
  specs: NodeSpecJSON[]
): string | undefined => {
  if (!handleId) return undefined;
  const specSockets = getSocketsByNodeTypeAndHandleType(
    specs,
    node.data?.type,
    handleType
  );
  if (!specSockets) return undefined;
  const dynamic =
    handleType === 'source'
      ? node.data.dynamicPorts?.outputs
      : node.data.dynamicPorts?.inputs;
  const sockets = mergeSockets(specSockets, dynamic);
  return sockets.find((s) => s.name === handleId)?.valueType;
};

export type ConverterInsertion = { node: IBehaveNode; edges: Edge[] };

/**
 * If a connection joins different-but-convertible value types, build the
 * converter node and the two edges needed to splice it in between source and
 * target. Returns null when the types match, can't be resolved, or no converter
 * is registered.
 */
export const buildConverterInsertion = (
  connection: Connection,
  nodes: Node[],
  specs: NodeSpecJSON[],
  conversions?: ConversionRule[]
): ConverterInsertion | null => {
  if (!connection.source || !connection.target) return null;

  const sourceNode = nodes.find((n) => n.id === connection.source) as
    | IBehaveNode
    | undefined;
  const targetNode = nodes.find((n) => n.id === connection.target) as
    | IBehaveNode
    | undefined;
  if (!sourceNode || !targetNode) return null;

  const sourceType = getSocketValueType(
    sourceNode,
    connection.sourceHandle,
    'source',
    specs
  );
  const targetType = getSocketValueType(
    targetNode,
    connection.targetHandle,
    'target',
    specs
  );
  if (!sourceType || !targetType) return null;
  if (sourceType === targetType) return null;
  if (sourceType === 'flow' || targetType === 'flow') return null;

  const converter = resolveConverter(specs, sourceType, targetType, conversions);
  if (!converter) return null;

  const { nodeType, inputName: inName, outputName: outName } = converter;

  const position: XYPosition = {
    x: (sourceNode.position.x + targetNode.position.x) / 2,
    y: (sourceNode.position.y + targetNode.position.y) / 2
  };

  const convId = uuidv4();
  const node: IBehaveNode = {
    id: convId,
    type: 'behaveNode',
    position,
    data: {
      type: nodeType,
      configuration: {},
      ports: {},
      dynamicPorts: {}
    }
  };

  const edges: Edge[] = [
    {
      id: uuidv4(),
      source: connection.source,
      sourceHandle: connection.sourceHandle ?? undefined,
      target: convId,
      targetHandle: inName
    },
    {
      id: uuidv4(),
      source: convId,
      sourceHandle: outName,
      target: connection.target,
      targetHandle: connection.targetHandle ?? undefined
    }
  ];

  return { node, edges };
};
