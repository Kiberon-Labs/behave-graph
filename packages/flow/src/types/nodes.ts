import type { DynamicPorts } from '@/types';
import type { Node } from 'reactflow';

/**
 * These are the behave nodes in the scene
 */
export type IBehaveNode = Omit<Node, 'data' | 'type'> & {
  type: 'behaveNode';
  data: {
    annotations?: Record<string, any>;
    type: string;
    dynamicPorts: DynamicPorts;
    ports?: Record<string, any>;
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

export type IGroupNode = Omit<Node, 'data' | 'type'> & {
  type: 'group';
  data: {
    color: string;
  };
};

export type IAINode = Omit<Node, 'data' | 'type'> & {
  type: 'behaveNode:ai';
  data: {
    annotations?: Record<string, any>;
    type: string;
    ports?: DynamicPorts;
    configuration: Record<string, any>;
  };
};

export type AnyNode = IBehaveNode | ICommentNode | IAINode | IGroupNode;
export type AnyNodeType = AnyNode['type'];
