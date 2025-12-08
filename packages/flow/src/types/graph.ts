import type { GraphJSON } from '@kinforge/behave-graph';
import type { Edge, Node } from 'reactflow';

export type UIGraphJSON = {
  /**
   * Version of the graph
   */
  v: string;
  name: string;
  /**
   * Graph annotations as metadata
   */
  annotations: Record<string, unknown>;

  /** User specific */
  user?: {
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
    /**
     * Saved viewports for multiple positions
     */
    viewports?: {
      x: number;
      y: number;
      zoom: number;
    }[];
  };

  /**
   * Arbitrary data associated with the graph.
   * Expected to be used with plugins/extensions. This is seperate from graph annotations
   */
  data: Record<string, unknown>;
  /**
   * The serialized graph data.
   * This is currently the embedded JSON format from behave-graph
   */
  flow: GraphJSON;
  nodes: Node[];
  edges: Edge[];
};
