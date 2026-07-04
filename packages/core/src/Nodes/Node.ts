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

  // Cached state proxy plus the state service resolved at proxy-creation time.
  // Refreshing the service once per createStateProxy call (i.e. per trigger)
  // instead of on every property access keeps per-iteration cost low while
  // still picking up a service registered between triggers.
  private _stateProxy: any;
  private _stateService: IStateService | undefined;
  // Whether _state is owned by this instance (safe to mutate in place). The
  // initial state object comes from the shared node definition, so it must be
  // cloned before the first in-place write.
  private _stateOwned = false;

  createStateProxy() {
    this._stateService = this.graph.getDependency('IStateService', true);
    if (this._stateProxy) return this._stateProxy;

    const handler = {
      get: (_: any, property: string) => {
        const stateService = this._stateService;
        if (stateService) {
          const serviceState = stateService.getState(this.id);
          // handle when state is undefined or null.  This can happen when a
          // node is first created and has not yet been initialized
          if (!serviceState) {
            stateService.setState(this.id, this._state);
            return this._state?.[property];
          }
          return serviceState[property];
        }
        return this._state?.[property];
      },
      set: (_: any, property: string, value: any) => {
        const stateService = this._stateService;
        if (stateService) {
          const prevState = stateService.getState(this.id);
          stateService.setState(this.id, { ...prevState, [property]: value });
          return true;
        }
        // fast path: mutate in place, cloning once so the shared definition
        // initial state (or an externally provided object) is never mutated
        if (!this._stateOwned) {
          this._state = { ...this._state };
          this._stateOwned = true;
        }
        this._state[property] = value;
        return true; // Indicate that the assignment was successful
      }
    };

    this._stateProxy = new Proxy({}, handler);
    return this._stateProxy;
  }

  getState() {
    const stateService = this.graph.getDependency('IStateService', true);
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
    const stateService = this.graph.getDependency('IStateService', true);
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
    this._state = typeof value === 'function' ? value(this._state) : value;
    // the new state object came from outside; clone before the next in-place write
    this._stateOwned = false;
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
