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

/**
 * Presentational markdown note, contributed by the notes plugin
 * (`@/plugin/notes`). `commentNode` is the legacy type string notes carried
 * when they lived in the core editor.
 */
export type INoteNode = Omit<Node, 'data' | 'type'> & {
  type: 'noteNode' | 'commentNode';
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

export type AnyNode = IBehaveNode | INoteNode | IAINode | IGroupNode;
export type AnyNodeType = AnyNode['type'];
