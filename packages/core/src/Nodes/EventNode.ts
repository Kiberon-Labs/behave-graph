import { Assert } from '../Diagnostics/Assert.js';
import { Engine } from '../Execution/Engine.js';
import type { IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { Node, type NodeConfiguration } from './Node.js';
import { type IEventNodeDefinition } from './NodeDefinitions.js';
import { type IEventNode, type INode, NodeType } from './NodeInstance.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import { NodeDescription } from './Registry/NodeDescription.js';

// no flow inputs, always evaluated on startup
export class EventNode extends Node<'Event'> implements IEventNode {
  constructor(
    description: NodeDescription,
    graph: IGraph,
    inputs: Socket[] = [],
    outputs: Socket[] = [],
    configuration: NodeConfiguration = {},
    id: string
  ) {
    super({
      ...description,
      description: {
        ...description,
        category: description.category as NodeCategoryType
      },
      id,
      inputs,
      outputs,
      graph,
      configuration,
      nodeType: NodeType.Event
    });
    // no input flow sockets allowed.
    Assert.mustBeTrue(
      !this.inputs.some((socket) => socket.valueTypeName === 'flow')
    );

    // must have at least one output flow socket
    Assert.mustBeTrue(
      this.outputs.some((socket) => socket.valueTypeName === 'flow')
    );
  }

  // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
  init(engine: Engine) {
    throw new Error('not implemented');
  }

  // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
  dispose(engine: Engine) {
    throw new Error('not implemented');
  }
}

export class EventNode2 extends EventNode {
  constructor(props: {
    description: NodeDescription;
    graph: IGraph;
    inputs?: Socket[];
    outputs?: Socket[];
    configuration?: NodeConfiguration;
    id: string;
  }) {
    super(
      props.description,
      props.graph,
      props.inputs,
      props.outputs,
      props.configuration,
      props.id
    );
  }
}

export class EventNodeInstance<TEventNodeDef extends IEventNodeDefinition>
  extends Node<'Event'>
  implements IEventNode
{
  private initInner: TEventNodeDef['init'];
  private disposeInner: TEventNodeDef['dispose'];
  private readonly outputSocketKeys: string[];

  constructor(
    nodeProps: Omit<INode, 'nodeType'> &
      Pick<TEventNodeDef, 'init' | 'dispose' | 'initialState'>
  ) {
    super({ ...nodeProps, nodeType: NodeType.Event });
    this.initInner = nodeProps.init;
    this.disposeInner = nodeProps.dispose;
    this._state = nodeProps.initialState;
    this.outputSocketKeys = nodeProps.outputs.map((s) => s.name);
  }

  init = async (engine: Engine): Promise<any> => {
    const stateProxy = this.createStateProxy();
    const state = await this.initInner({
      node: this,
      engine: engine,
      read: this.readInput,
      write: this.writeOutput,
      state: stateProxy,
      outputSocketKeys: this.outputSocketKeys,
      commit: (outFlowname, fiberCompletedListener) =>
        engine.commitToNewFiber(this, outFlowname, fiberCompletedListener),
      configuration: this.configuration,
      graph: this.graph
    });

    if (!state) return;
    Object.keys(state).forEach((key) => {
      stateProxy[key] = state[key];
    });
  };

  async dispose(): Promise<void> {
    const currentState = this.createStateProxy();
    this.disposeInner({
      state: currentState,
      graph: this.graph
    });
  }
}
