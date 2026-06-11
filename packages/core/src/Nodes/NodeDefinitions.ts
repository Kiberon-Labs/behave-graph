import type { SocketsList, SocketsMap } from '~/types/socket.js';
import type { Engine } from '../engine/Engine.js';
import type { FiberListenerInner } from '../engine/Fiber.js';
import type { IGraph } from '../Graphs/Graph.js';
import { AsyncNodeInstance } from './AsyncNode.js';
import { EventNodeInstance } from './EventNode.js';
import { FlowNodeInstance } from './FlowNode.js';
import { FunctionNodeInstance } from './FunctionNode.js';
import type { NodeConfiguration } from './Node.js';
import { makeCommonProps } from './nodeFactory.js';
import { type INode, NodeType } from './NodeInstance.js';
import type { NodeCategoryType } from './Registry/NodeCategory.js';
import type { NodeConfigurationDescription } from './Registry/NodeDescription.js';

export type SocketsGeneratorFromConfig = (
  nodeConfig: NodeConfiguration,
  graph: IGraph
) => SocketsList;

export type SocketsDefinition = SocketsMap | SocketsGeneratorFromConfig;

export type NodeFactory = (
  graph: IGraph,
  config: NodeConfiguration,
  id: string
) => INode;

export interface IHasNodeFactory {
  readonly nodeFactory: NodeFactory;
}

export interface INodeDefinition<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TConfig extends NodeConfigurationDescription = NodeConfigurationDescription
> extends IHasNodeFactory {
  category?: NodeCategoryType;
  typeName: string;
  otherTypeNames?: string[];
  aliases?: string[]; // for backwards compatibility
  helpDescription?: string;
  label?: string;
  in: TInput;
  out: TOutput;
  metadata?: Record<string, any>;
  configuration?: TConfig;
}

export type SocketNames<TSockets extends SocketsDefinition> =
  TSockets extends SocketsMap ? keyof TSockets : any;

export type TriggeredFn<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TState = any
> = (params: {
  // now read will only allow keys of the input types
  read<T>(inValueName: SocketNames<TInput>): T;
  // write and commit only allows keys from the output type
  write<T>(outValueName: SocketNames<TOutput>, value: T): void;
  commit(
    outFlowName: SocketNames<TOutput>,
    fiberCompletedListener?: FiberListenerInner
  ): void; // commits to current fiber unless 'async-flow' or 'event-flow'
  outputSocketKeys: SocketNames<TOutput>[];
  triggeringSocketName: keyof TInput;
  // state of the node.
  state: TState;
  engine?: Engine;
  node?: INode;
  graph: IGraph;
  configuration: NodeConfiguration;
  finished?: () => void;
}) => void | Promise<void>;

/** Flow Node Definition */
export type TriggeredParams<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TState
> = Parameters<TriggeredFn<TInput, TOutput, TState>>[0];

export interface IHasInitialState<TState> {
  initialState: TState;
}

export interface IHasTriggered<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TState
> extends IHasInitialState<TState> {
  triggered: TriggeredFn<TInput, TOutput, TState>;
}

export type StateReturn<TState> = TState extends undefined ? void : TState;

export type EventNodeSetupParams<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TState
> = Omit<TriggeredParams<TInput, TOutput, TState>, 'triggeringSocketName'>;

export interface IHasInit<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TState
> {
  init: (
    params: EventNodeSetupParams<TInput, TOutput, TState>
  ) => StateReturn<TState>;
}

export interface IHasDispose<TState> {
  dispose: (params: { state: TState; graph: IGraph }) => StateReturn<TState>;
}

export interface IFlowNodeDefinition<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TConfig extends NodeConfigurationDescription = NodeConfigurationDescription,
  TState = any
> extends INodeDefinition<TInput, TOutput, TConfig>,
    IHasInitialState<TState>,
    IHasTriggered<TInput, TOutput, TState> {}

// async node is the same as an event node, without the init function.
export interface IAsyncNodeDefinition<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TConfig extends NodeConfigurationDescription = NodeConfigurationDescription,
  TState = any
> extends INodeDefinition<TInput, TOutput, TConfig>,
    IHasInitialState<TState>,
    IHasTriggered<TInput, TOutput, TState>,
    IHasDispose<TState> {}

export type OmitFactoryAndType<T extends INodeDefinition> = Omit<
  T,
  'nodeFactory' | 'nodeType'
>;

export interface FunctionNodeExecParams<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition
> {
  // now read will only allow keys of the input types
  read<T>(inValueName: SocketNames<TInput>): T;
  // write and commit only allows keys from the output type
  write<T>(outValueName: SocketNames<TOutput>, value: T): void;

  /** The concrete node instance being executed (if available). */
  node?: INode;

  graph: IGraph;
  configuration: NodeConfiguration;
}

export interface IFunctionNodeDefinition<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TConfig extends NodeConfigurationDescription = NodeConfigurationDescription
> extends INodeDefinition<TInput, TOutput, TConfig> {
  exec: (
    params: FunctionNodeExecParams<TInput, TOutput>
  ) => Promise<void> | void;
}

export interface IEventNodeDefinition<
  TInput extends SocketsDefinition = SocketsDefinition,
  TOutput extends SocketsDefinition = SocketsDefinition,
  TConfig extends NodeConfigurationDescription = NodeConfigurationDescription,
  TState = any
> extends INodeDefinition<TInput, TOutput, TConfig>,
    IHasInitialState<TState>,
    IHasInit<TInput, TOutput, TState>,
    IHasDispose<TState> {}

// HELPER FUNCTIONS

// helper function to not require you to define generics when creating a node def:
export function makeFlowNodeDefinition<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TConfig extends NodeConfigurationDescription,
  TState
>(
  definition: OmitFactoryAndType<
    IFlowNodeDefinition<TInput, TOutput, TConfig, TState>
  >
): IFlowNodeDefinition<TInput, TOutput, TConfig, TState> {
  return {
    ...definition,
    nodeFactory: (graph, config, id) =>
      new FlowNodeInstance({
        ...makeCommonProps(NodeType.Flow, definition, config, graph, id),
        initialState: definition.initialState,
        triggered: definition.triggered
      })
  };
}

export function makeAsyncNodeDefinition<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TConfig extends NodeConfigurationDescription,
  TState
>(
  definition: OmitFactoryAndType<
    IAsyncNodeDefinition<TInput, TOutput, TConfig, TState>
  >
): IAsyncNodeDefinition<TInput, TOutput, TConfig, TState> {
  return {
    ...definition,
    nodeFactory: (graph, config, id) =>
      new AsyncNodeInstance({
        ...makeCommonProps(NodeType.Async, definition, config, graph, id),
        initialState: definition.initialState,
        triggered: definition.triggered,
        dispose: definition.dispose
      })
  };
}

export function makeEventNodeDefinition<
  TInput extends SocketsDefinition,
  TOutput extends SocketsDefinition,
  TConfig extends NodeConfigurationDescription,
  TState
>(
  definition: OmitFactoryAndType<
    IEventNodeDefinition<TInput, TOutput, TConfig, TState>
  >
): IEventNodeDefinition<TInput, TOutput, TConfig, TState> {
  return {
    ...definition,
    nodeFactory: (graph, config, id) =>
      new EventNodeInstance({
        ...makeCommonProps(NodeType.Event, definition, config, graph, id),
        initialState: definition.initialState,
        init: definition.init,
        dispose: definition.dispose
      })
  };
}
