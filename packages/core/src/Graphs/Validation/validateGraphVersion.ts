import type { GraphInstance } from '../Graph.js';

export function validateGraphVersion(graph: GraphInstance): string[] {
  const errorList: string[] = [];
  if (graph.v !== 1) {
    errorList.push('Graph version is not set');
  }
  return errorList;
}
