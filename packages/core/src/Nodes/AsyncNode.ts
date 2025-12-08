import { Assert } from '../Diagnostics/Assert.js';
import { Engine } from '../Execution/Engine.js';
import { type IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { Node, type NodeConfiguration } from './Node.js';
import { type IAsyncNodeDefinition } from './NodeDefinitions.js';
import { type IAsyncNode, type INode, NodeType } from './NodeInstance.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import { NodeDescription } from './Registry/NodeDescription.js';

// async flow node with only a single flow input
export class AsyncNode extends Node<'Async'> {
  constructor(
    description: NodeDescription,
    graph: IGraph,
    inputs: Socket[] = [],
    outputs: Socket[] = [],
    configuration: NodeConfiguration = {},
    id: string = rando
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
      nodeType: NodeType.Async,
      configuration
    });

    // must have at least one input flow socket
    Assert.mustBeTrue(
      this.inputs.some((socket) => socket.valueTypeName === 'flow')
    );

    // must have at least one output flow socket
    Assert.mustBeTrue(
      this.outputs.some((socket) => socket.valueTypeName === 'flow')
    );
  }

  triggered(
    // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
    engine: Engine,
    // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
    triggeringSocketName: string,
    // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
    finished: () => void
  ) {
    throw new Error('not implemented');
  }

  dispose() {
    throw new Error('not implemented');
  }
}

export class AsyncNode2 extends AsyncNode {
  constructor(props: {
    description: NodeDescription;
    graph: IGraph;
    inputs?: Socket[];
    outputs?: Socket[];
    id: string;
  }) {
    super(
      props.description,
      props.graph,
      props.inputs,
      props.outputs,
      {},
      props.id
    );
  }
}

export class AsyncNodeInstance<TAsyncNodeDef extends IAsyncNodeDefinition>
  extends Node<'Async'>
  implements IAsyncNode
{
  private triggeredInner: TAsyncNodeDef['triggered'];
  private disposeInner: TAsyncNodeDef['dispose'];

  constructor(
    node: Omit<INode, 'nodeType'> &
      Pick<TAsyncNodeDef, 'triggered' | 'initialState' | 'dispose'>
  ) {
    super({ ...node, nodeType: NodeType.Async });

    this.triggeredInner = node.triggered;
    this.disposeInner = node.dispose;

    this._state = node.initialState;
  }

  triggered = (
    engine: Pick<Engine, 'commitToNewFiber'>,
    triggeringSocketName: string,
    finished: () => void
  ) => {
    const stateProxy = this.createStateProxy();

    const state = this.triggeredInner({
      read: this.readInput,
      write: this.writeOutput,
      commit: (outFlowname, fiberCompletedListener) =>
        engine.commitToNewFiber(this, outFlowname, fiberCompletedListener),
      configuration: this.configuration,
      graph: this.graph,
      state: stateProxy,
      finished,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeringSocketName
    });

    if (!state) return;
    Object.keys(state).forEach((key) => {
      stateProxy[key] = state[key];
    });
  };
  dispose = async () => {
    const stateProxy = this.createStateProxy();
    const state = this.disposeInner({
      state: stateProxy,
      graph: this.graph
    });

    if (!state) return;
    Object.keys(state).forEach((key) => {
      stateProxy[key] = state[key];
    });
  };
}
