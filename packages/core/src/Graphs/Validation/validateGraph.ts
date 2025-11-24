import type { GraphInstance } from '../Graph.js';
import { validateGraphAcyclic } from './validateGraphAcyclic.js';
import { validateGraphLinks } from './validateGraphLinks.js';
import { validateGraphVersion } from './validateGraphVersion.js';

export function validateGraph(graph: GraphInstance): string[] {
  const errorList: string[] = [];
  errorList.push(
    ...validateGraphVersion(graph),
    ...validateGraphAcyclic(graph.nodes),
    ...validateGraphLinks(graph.nodes)
  );
  return errorList;
}
