import type { Node } from 'reactflow';

/**
 * These are the behave nodes in the scene
 */
export type IBehaveNode = Omit<Node, 'data' | 'type'> & {
  type: 'behaveNode';
  data: {
    annotations?: Record<string, any>;
    type: string;
    ports: Record<string, any>;
    configuration: Record<string, any>;
  };
};

export type ICommentNode = Omit<Node, 'data' | 'type'> & {
  type: 'commentNode';
  data: {
    annotations?: Record<string, any>;
    text: string;
    fontSize?: string;
  };
};

export type AnyNode = IBehaveNode | ICommentNode;
export type AnyNodeType = AnyNode['type'];
