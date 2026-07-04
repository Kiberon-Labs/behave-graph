import type {
  SocketDefinition,
  SocketListDefinition,
  SocketsList
} from '~/types/socket.js';
import { Assert } from '../Diagnostics/Assert.js';
import type { IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { Node, type NodeConfiguration } from './Node.js';
import {
  type IFunctionNodeDefinition,
  type OmitFactoryAndType,
  type SocketsDefinition
} from './NodeDefinitions.js';
import { type IFunctionNode, type INode, NodeType } from './NodeInstance.js';
import { readInputFromSockets, writeOutputsToSocket } from './NodeSockets.js';
import { isThenable } from '../utils/isThenable.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import { NodeDescription } from './Registry/NodeDescription.js';
import { makeCommonProps } from './nodeFactory.js';

export function makeFunctionNodeDefinition<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition
>(
  definition: OmitFactoryAndType<IFunctionNodeDefinition<TInput, TOutput>>
): IFunctionNodeDefinition<TInput, TOutput> {
  return {
    ...definition,
    nodeFactory: (graph, nodeConfig, id) =>
      new FunctionNodeInstance({
        ...makeCommonProps(
          NodeType.Function,
          definition,
          nodeConfig,
          graph,
          id
        ),
        exec: definition.exec
      })
  };
}

export abstract class FunctionNode
  extends Node<'Function'>
  implements IFunctionNode
{
  public readonly exec: (node: INode) => Promise<void> | void;
  constructor(
    description: NodeDescription,
    graph: IGraph,
    inputs: Socket[] = [],
    outputs: Socket[] = [],
    exec: (node: INode) => Promise<void> | void,
    configuration: NodeConfiguration = {},
    id: string
  ) {
    super({
      description: {
        ...description,
        category: description.category as NodeCategoryType
      },
      id,
      inputs,
      outputs,
      graph,
      configuration,
      nodeType: NodeType.Function
    });
    this.exec = exec;

    // must have no input flow sockets
    Assert.mustBeTrue(
      !this.inputs.some((socket) => socket.valueTypeName === 'flow')
    );

    // must have no output flow sockets
    Assert.mustBeTrue(
      !this.outputs.some((socket) => socket.valueTypeName === 'flow')
    );
  }
}

export class FunctionNodeInstance<
    TFunctionNodeDef extends IFunctionNodeDefinition
  >
  extends Node<'Function'>
  implements IFunctionNode
{
  private execInner: TFunctionNodeDef['exec'];
  // exec params are identical between calls for the same target node, so the
  // object (and its read/write closures) is allocated once and reused. This
  // is a hot path: function nodes re-execute for every value resolution.
  private _execParams:
    | (Parameters<TFunctionNodeDef['exec']>[0] & { node: INode })
    | undefined;

  constructor(
    nodeProps: Omit<INode, 'nodeType'> & Pick<TFunctionNodeDef, 'exec'>
  ) {
    super({ ...nodeProps, nodeType: NodeType.Function });

    this.execInner = nodeProps.exec;
  }

  // Not declared async: returns the inner exec's result directly so callers
  // can stay synchronous when the node's exec is synchronous.
  exec = (node: INode): void | Promise<void> => {
    let params = this._execParams;
    if (params === undefined || params.node !== node) {
      params = {
        read: (name: string) =>
          readInputFromSockets(node.inputs, name, node.description.typeName),
        write: (name: string, value: any) =>
          writeOutputsToSocket(
            node.outputs,
            name,
            value,
            node.description.typeName
          ),
        node,
        configuration: this.configuration,
        graph: this.graph
      } as typeof this._execParams;
      this._execParams = params;
    }
    return this.execInner(params!) as void | Promise<void>;
  };
}

const alpha = 'abcdefghijklmnop';
const getAlphabeticalKey = (index: number): string =>
  alpha[index % alpha.length] as string;

type KeyedSocketShorthand = { [key: string]: string | SocketDefinition } & {
  key?: never;
  valueType?: never;
};

/** Converts list of sockets specifying value type names to an ordeered list of sockets,
 */

function makeSocketsList(
  sockets: (string | SocketListDefinition | KeyedSocketShorthand)[] | undefined,
  getKey: (index: number) => string
): SocketsList {
  if (!sockets || sockets.length === 0) return [];

  return sockets.map((x, i): SocketListDefinition => {
    if (typeof x === 'string') {
      return {
        key: getKey(i),
        valueType: x
      };
    }

    if (typeof x === 'object' && x !== null && 'key' in x && 'valueType' in x) {
      return x as SocketListDefinition;
    }

    return {
      key: Object.keys(x)[0]!,
      ...(typeof x[Object.keys(x)[0]!] === 'string'
        ? {
            valueType: (x as Record<string, string>)[
              Object.keys(x)[0]!
            ] as string
          }
        : (x as Record<string, SocketDefinition>)[Object.keys(x)[0]!]!)
    } as SocketListDefinition;
  });
}

export function makeInNOutFunctionDesc({
  in: inputs,
  out,
  exec,
  category,
  ...rest
}: {
  name: string;
  label: string;
  aliases?: string[];
  in?: (string | { [key: string]: string })[];
  out: (string | { [key: string]: string })[] | string;
  category?: NodeCategoryType;
  exec: (...args: any[]) => Promise<any> | any;
}) {
  const inputSockets = makeSocketsList(inputs, getAlphabeticalKey);
  const outputKeyFunc =
    typeof out === 'string' || out.length > 1
      ? () => 'result'
      : getAlphabeticalKey;
  const outList = typeof out === 'string' ? [out] : out;
  const outputSockets = makeSocketsList(outList, outputKeyFunc);

  const singleResult =
    outputSockets.length === 1 && outputSockets[0]!.key === 'result';

  const writeResults = (
    write: (key: string, value: any) => void,
    results: any
  ) => {
    if (singleResult) {
      write('result', results);
    } else {
      for (const { key } of outputSockets) {
        write(key, results[key]);
      }
    }
  };

  const definition = makeFunctionNodeDefinition({
    typeName: rest.name,
    label: rest.label,
    in: () => inputSockets,
    out: () => outputSockets,
    category,
    // Not declared async: most math/logic execs are synchronous, and keeping
    // this wrapper synchronous avoids a promise allocation per evaluation.
    // The common 1- and 2-input arities skip the argument-array allocation.
    exec: ({ read, write }) => {
      let results;
      switch (inputSockets.length) {
        case 0:
          results = exec();
          break;
        case 1:
          results = exec(read(inputSockets[0]!.key));
          break;
        case 2:
          results = exec(
            read(inputSockets[0]!.key),
            read(inputSockets[1]!.key)
          );
          break;
        default:
          results = exec(...inputSockets.map(({ key }) => read(key)));
      }
      if (isThenable(results)) {
        return results.then((resolved) => writeResults(write, resolved));
      }
      writeResults(write, results);
    }
  });

  return definition;
}

type PureCache = {
  inputKeys: WeakMap<Socket, unknown>;
  outputValues: WeakMap<Socket, unknown>;
  hasCachedOutputs: boolean;
};

const getInputKey = (value: unknown): unknown => {
  if (value === null) return null;
  const valueType = typeof value;
  if (valueType !== 'object') return value;

  const maybeVersion = (value as any)?.version;
  if (typeof maybeVersion === 'number') return maybeVersion;

  const maybeRevision = (value as any)?.revision;
  if (typeof maybeRevision === 'number') return maybeRevision;

  return value;
};

export function makePureInOutFunctionDesc<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition
>({
  ...definition
}: Omit<
  IFunctionNodeDefinition<TInput, TOutput>,
  'nodeFactory' | 'nodeType'
>): IFunctionNodeDefinition<TInput, TOutput> {
  const nodeCache = new WeakMap<object, PureCache>();
  const execInner = definition.exec;

  return makeFunctionNodeDefinition<TInput, TOutput>({
    ...(definition as any),
    exec: async (params) => {
      const node = params.node;
      if (node === undefined) {
        await execInner(params as any);
        return;
      }

      let cache = nodeCache.get(node);
      if (cache === undefined) {
        cache = {
          inputKeys: new WeakMap<Socket, unknown>(),
          outputValues: new WeakMap<Socket, unknown>(),
          hasCachedOutputs: false
        };
        nodeCache.set(node, cache);
      }

      let inputsChanged = false;
      for (const inputSocket of node.inputs) {
        const currentKey = getInputKey(inputSocket.value);
        const previousKey = cache.inputKeys.get(inputSocket);
        if (!Object.is(previousKey, currentKey)) {
          inputsChanged = true;
          break;
        }
      }

      if (!inputsChanged && cache.hasCachedOutputs) {
        for (const outputSocket of node.outputs) {
          const cached = cache.outputValues.get(outputSocket);
          if (cached !== undefined || cache.outputValues.has(outputSocket)) {
            // write is typed to socket keys, but at runtime it's always string.
            params.write(outputSocket.name as any, cached as any);
          }
        }
        return;
      }

      // Execute and capture outputs.
      cache.outputValues = new WeakMap<Socket, unknown>();
      cache.hasCachedOutputs = false;

      const outputSocketByName = new Map<string, Socket>();
      for (const outputSocket of node.outputs)
        outputSocketByName.set(outputSocket.name, outputSocket);

      const wrappedParams = {
        ...params,
        write: (outValueName: any, value: any) => {
          params.write(outValueName, value);
          const socket = outputSocketByName.get(String(outValueName));
          if (socket !== undefined) {
            cache!.outputValues.set(socket, value);
            cache!.hasCachedOutputs = true;
          }
        }
      };

      await execInner(wrappedParams as any);

      // Record input keys after successful exec.
      for (const inputSocket of node.inputs) {
        cache.inputKeys.set(inputSocket, getInputKey(inputSocket.value));
      }
    }
  });
}
