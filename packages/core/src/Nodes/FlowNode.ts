import { Assert } from '../Diagnostics/Assert.js';
import { Fiber } from '../engine/Fiber.js';
import type { IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { Node, type NodeConfiguration } from './Node.js';
import { type IFlowNodeDefinition } from './NodeDefinitions.js';
import { type IFlowNode, type INode, NodeType } from './NodeInstance.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import { NodeDescription } from './Registry/NodeDescription.js';

export class FlowNode extends Node<'Flow'> implements IFlowNode {
  constructor(
    description: NodeDescription,
    graph: IGraph,
    inputs: Socket[] = [],
    outputs: Socket[] = [],
    configuration: NodeConfiguration = {},
    id: string
  ) {
    // determine if this is an eval node
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
      nodeType: NodeType.Flow
    });

    // must have at least one input flow socket
    Assert.mustBeTrue(
      this.inputs.some((socket) => socket.valueTypeName === 'flow')
    );
  }

  // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
  triggered(fiber: Fiber, triggeringSocketName: string) {
    throw new Error('not implemented');
  }
}

export class FlowNode2 extends FlowNode {
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

export class FlowNodeInstance<TFlowNodeDefinition extends IFlowNodeDefinition>
  extends Node<'Flow'>
  implements IFlowNode
{
  private triggeredInner: TFlowNodeDefinition['triggered'];
  // private _state!: TFlowNodeDefinition['initialState'];
  private readonly outputSocketKeys: string[];
  constructor(
    nodeProps: Omit<INode, 'nodeType'> &
      Pick<TFlowNodeDefinition, 'triggered' | 'initialState'>
  ) {
    super({ ...nodeProps, nodeType: NodeType.Flow });
    this.triggeredInner = nodeProps.triggered;
    this._state = nodeProps.initialState;
    this.outputSocketKeys = nodeProps.outputs.map((s) => s.name);
  }

  // Not declared async: the engine's hot path stays promise-free when the
  // node's triggered function is synchronous. The execution handler awaits
  // the returned value only when it is actually a promise.
  public triggered = (
    fiber: Fiber,
    triggeringSocketName: string
  ): void | Promise<void> => {
    const stateProxy = this.createStateProxy();

    return this.triggeredInner({
      commit: (outFlowName, fiberCompletedListener) =>
        fiber.commit(this, outFlowName, fiberCompletedListener),
      read: this.readInput,
      write: this.writeOutput,
      graph: this.graph,
      state: stateProxy,
      configuration: this.configuration,
      outputSocketKeys: this.outputSocketKeys,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      triggeringSocketName
    }) as void | Promise<void>;
  };
}
