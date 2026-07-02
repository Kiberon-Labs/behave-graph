import { describe, expect, it } from 'vitest';
import {
  DefaultLogger,
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  registerCoreProfile,
  validateGraph,
  type Dependencies,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import { registerAIProfile } from '../src/index.js';
import basicChat from '../stories/data/basicChat.json';
import toolUse from '../stories/data/toolUse.json';
import exploration from '../stories/data/exploration.json';

// Build the execution registry the examples run against (core + AI).
const registry = registerAIProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger()
    } as Dependencies
  })
);

const examples: Record<string, GraphJSON> = {
  basicChat: basicChat as GraphJSON,
  toolUse: toolUse as GraphJSON,
  exploration: exploration as GraphJSON
};

describe('AI example graphs', () => {
  for (const [name, graphJson] of Object.entries(examples)) {
    it(`${name} parses against the core+AI registry and validates clean`, () => {
      const graph = readGraphFromJSON({ graphJson, registry });
      // Every node type, socket and link resolves, and the graph is acyclic.
      expect(validateGraph(graph)).toEqual([]);
    });
  }
});
