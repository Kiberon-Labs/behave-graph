import type { Viewport } from 'reactflow';
import type { GraphSession } from './graphSession';
import type { Edge } from 'reactflow';
import type { UIGraphJSON } from '@/types/graph';

/**
 * This is our internal graph representation that we use to perform transformations on
 * It represents the general graph structure, not the underlying behavior graph instance
 */
export class Graph {
  public readonly viewports: Viewport[] = [];
  private sys: GraphSession;

  constructor(session: GraphSession) {
    this.sys = session;
  }

  setViewport(index: number, viewport: Viewport) {
    this.viewports[index] = viewport;
    this.sys.pubsub.publish('saveViewport', {
      index: index,
      viewport: viewport
    });
  }

  /**
   * Clears the graph
   */
  clear() {
    const nodes = this.sys.nodeStore.getState().nodes;
    const edges = this.sys.edgeStore.getState().edges;
    this.sys.undoManager.execute({
      name: 'Clear graph',
      undo: () => {
        this.sys.nodeStore.getState().setNodes(Object.values(nodes));
        this.sys.edgeStore.getState().setEdges(Object.values(edges));
      },
      execute: () => {
        this.sys.nodeStore.getState().setNodes([]);
        this.sys.edgeStore.getState().setEdges([]);
      }
    });
  }

  /**
   * Return all edges that point into the nodes inputs.
   * O(m) the amount of edges
   */
  inEdges(nodeId: string, sourceHandle?: string): Edge[] {
    //Get the edges
    const edges = this.sys.edgeStore.getState().edges;

    return Object.values(edges).filter((x) => {
      if (x.target !== nodeId) {
        return false;
      }
      if (sourceHandle) {
        return x.targetHandle === sourceHandle;
      }
      return true;
    });
  }

  /**
   * Return all edges that are pointed out by node v.
   * O(m) the amount of edges
   */
  outEdges(nodeId: string, targetHandle?: string): Edge[] {
    //Get the edges
    const edges = this.sys.edgeStore.getState().edges;

    return Object.values(edges).filter((x) => {
      if (x.source !== nodeId) {
        return false;
      }
      if (targetHandle) {
        return x.targetHandle === targetHandle;
      }
      return true;
    });
  }

  serialize(): UIGraphJSON {
    const meta = this.sys.metaStore.getState();
    return {
      v: '1.0.0',
      name: meta.name,
      user: {
        viewport: this.viewports[0] || { x: 0, y: 0, zoom: 1 }
      },
      annotations: { ...meta.metadata },
      data: {
        layers: this.sys.layerStore.getState().serialize()
      },
      flow: {},
      nodes: Object.values(this.sys.nodeStore.getState().nodes),
      edges: Object.values(this.sys.edgeStore.getState().edges)
    };
  }

  getAnnotations() {
    return { ...this.sys.metaStore.getState().metadata };
  }

  setAnnotations(annotations: { [key: string]: any }) {
    this.sys.metaStore.getState().mergeMetadata(annotations);
    this.sys.pubsub.publish('graphAnnotationsChanged', this.getAnnotations());
  }

  deseralize(data: UIGraphJSON) {
    //Load nodes
    this.sys.nodeStore.getState().setNodes(data.nodes);
    this.sys.edgeStore.getState().setEdges(data.edges);
    this.sys.metaStore.getState().setMetadata(data.annotations || {});
    if (data.name) this.sys.metaStore.getState().setName(data.name);
    this.sys.layerStore.getState().deserialize(data.data?.layers);

    // Restore viewport
    if (data.user?.viewport) {
      const reactflow = this.sys.refStore.getState().getRef('reactflow');
      if (reactflow) {
        reactflow.setViewport(data.user.viewport);
      }
    }

    // Restore multiple viewports if they exist
    if (data.user?.viewports) {
      this.viewports.splice(0, this.viewports.length, ...data.user.viewports);
    }
  }
}
