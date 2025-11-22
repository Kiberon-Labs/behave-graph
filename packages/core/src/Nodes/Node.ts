import type { GraphNodes, IGraph } from '../Graphs/Graph.js';
import { Socket } from '../Sockets/Socket.js';
import { type INode, NodeType } from './NodeInstance.js';
import { readInputFromSockets, writeOutputsToSocket } from './NodeSockets.js';
import type { INodeDescription } from './Registry/NodeDescription.js';

export interface IStateService {
  storeEvent(event: any): void;
  getState(nodeId: string): any;
  setState(nodeId: string, newState: any): void;
  rehydrateState(nodes: GraphNodes, stateKey?: string): Promise<void>;
  syncState(): Promise<void>;
  syncAndClearState(): Promise<void>;
  resetState(): Promise<void>;
}

export type NodeConfiguration = {
  [key: string]: any;
};

export type SetStateArgs =
  | Record<string, any>
  | ((prevState: Record<string, any>) => Record<string, any>);

export abstract class Node<TNodeType extends NodeType> implements INode {
  public readonly inputs: Socket[];
  public readonly outputs: Socket[];
  public readonly description: INodeDescription;
  // public typeName: string;
  public nodeType: TNodeType;
  public readonly otherTypeNames: string[] | undefined;
  public graph: IGraph;
  public label?: string;
  public metadata: any;
  public _state: any;
  public id: string;
  public readonly configuration: NodeConfiguration;

  createStateProxy() {
    const handler = {
      get: (_: any, property: string) => {
        // Get the current state
        const currentState = this.getState();
        return currentState[property];
      },
      set: (_: any, property: string, value: any) => {
        // Set the new value in the state
        this.setState((prevState) => ({
          ...prevState,
          [property]: value
        }));
        return true; // Indicate that the assignment was successful
      }
    };

    return new Proxy({}, handler);
  }

  getState() {
    const stateService = this.graph.getDependency<IStateService>(
      'IStateService',
      true
    );
    if (stateService) {
      const serviceState = stateService.getState(this.id);

      // handle when state is undefined or null.  This can happen when a node is first created
      // and has not yet been initialized
      if (!serviceState) {
        stateService.setState(this.id, this._state);
        return this._state;
      }
      return serviceState;
    }
    return this._state;
  }

  setState(value: SetStateArgs) {
    // check if value is an object and if so, check for functions and store them separately
    const stateService = this.graph.getDependency<IStateService>(
      'IStateService',
      true
    );
    if (stateService) {
      if (typeof value === 'function') {
        const prevState = stateService.getState(this.id);
        const newState = value(prevState);
        stateService.setState(this.id, newState);
        return;
      }

      stateService.setState(this.id, value);
      return;
    }

    this._state = value;
  }

  constructor(node: Omit<INode, 'nodeType'> & { nodeType: TNodeType }) {
    this.id = node.id;
    this.inputs = node.inputs;
    this.outputs = node.outputs;
    this.description = node.description;
    this.nodeType = node.nodeType;
    this.graph = node.graph;
    this.configuration = node.configuration;
    this.metadata = node.metadata || {};
  }

  readInput = <T>(inputName: string): T => {
    return readInputFromSockets(
      this.inputs,
      inputName,
      this.description.typeName
    );
  };

  writeOutput = <T>(outputName: string, value: T) => {
    writeOutputsToSocket(
      this.outputs,
      outputName,
      value,
      this.description.typeName
    );
  };
}
