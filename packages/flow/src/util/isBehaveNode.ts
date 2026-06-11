import type { IBehaveNode } from '@/types/nodes';
import type { Node } from 'reactflow';

export function isBehaveNode(node: Node): node is IBehaveNode {
  return typeof node.type === 'string' && node.type.startsWith('behaveNode');
}
