import { Assert } from '../Diagnostics/Assert.js';
import type { IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { Node, type NodeConfiguration } from './Node.js';
import {
  type IFunctionNodeDefinition,
  makeFunctionNodeDefinition,
  type SocketListDefinition,
  type SocketsList
} from './NodeDefinitions.js';
import { type IFunctionNode, type INode, NodeType } from './NodeInstance.js';
import { readInputFromSockets, writeOutputsToSocket } from './NodeSockets.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import { NodeDescription } from './Registry/NodeDescription.js';

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
  constructor(
    nodeProps: Omit<INode, 'nodeType'> & Pick<TFunctionNodeDef, 'exec'>
  ) {
    super({ ...nodeProps, nodeType: NodeType.Function });

    this.execInner = nodeProps.exec;
  }

  exec = async (node: INode) => {
    await this.execInner({
      read: (name) =>
        readInputFromSockets(node.inputs, name, node.description.typeName),
      write: (name, value) =>
        writeOutputsToSocket(
          node.outputs,
          name,
          value,
          node.description.typeName
        ),
      configuration: this.configuration,
      graph: this.graph
    });
  };
}

const alpha = 'abcdefghijklmnop';
const getAlphabeticalKey = (index: number): string =>
  alpha[index % alpha.length] as string;

/** Converts list of sockets specifying value type names to an ordeered list of sockets,
 */

function makeSocketsList(
  sockets: (string | { [key: string]: string })[] | undefined,
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
    return {
      key: Object.keys(x)[0]!,
      valueType: x[Object.keys(x)[0]!]!
    };
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

  const definition = makeFunctionNodeDefinition({
    typeName: rest.name,
    label: rest.label,
    in: () => inputSockets,
    out: () => outputSockets,
    category,
    exec: async ({ read, write }) => {
      const args = inputSockets.map(({ key }) => read(key));
      const results = await exec(...args);
      if (outputSockets.length === 1 && outputSockets[0]!.key === 'result') {
        write('result', results);
      } else {
        outputSockets.forEach(({ key }) => {
          write(key, results[key]);
        });
      }
    }
  });

  return definition;
}
