import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import { buildUIGraphJSON } from '../src/transformers/Uigraph.js';

describe('Save and Load Graph', () => {
  let system: System;

  beforeEach(() => {
    // Create a system with a basic registry
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });

    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const registry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    system = new System(registry);
    system.createSession('graph');
  });

  it('should save and load a graph with node positions', () => {
    // Setup: Create a graph with positioned nodes
    const initialNodes = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 100, y: 200 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      },
      {
        id: 'node2',
        type: 'behaveNode',
        position: { x: 300, y: 400 },
        data: {
          type: 'debug/log',
          configuration: {},
          ports: {},
          annotations: {}
        }
      }
    ];

    const initialEdges = [
      {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        sourceHandle: 'flow',
        targetHandle: 'flow'
      }
    ];

    system.nodeStore.getState().setNodes(initialNodes);
    system.edgeStore.getState().setEdges(initialEdges);

    // Save the graph
    const savedGraph = buildUIGraphJSON(system.session!);

    // Verify saved graph has nodes with positions
    expect(savedGraph.nodes).toHaveLength(2);
    expect(savedGraph.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(savedGraph.nodes[1].position).toEqual({ x: 300, y: 400 });

    // Clear the system
    system.nodeStore.getState().setNodes([]);
    system.edgeStore.getState().setEdges([]);

    // Load the graph
    system.graph.deseralize(savedGraph);
    system.flowStore.getState().setGraph(savedGraph.flow, { skipLayout: true });

    // Verify loaded nodes have correct positions
    const loadedNodes = system.nodeStore.getState().nodes;
    expect(loadedNodes).toHaveLength(2);
    expect(loadedNodes[0].position).toEqual({ x: 100, y: 200 });
    expect(loadedNodes[1].position).toEqual({ x: 300, y: 400 });
  });

  it('should preserve viewport when saving and loading', () => {
    // Setup: Create nodes and set viewport
    const mockReactFlow = {
      getViewport: () => ({ x: 50, y: 100, zoom: 1.5 }),
      setViewport: () => {}
    };

    system.refStore.getState().setRef('reactflow', mockReactFlow);

    const initialNodes = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 100, y: 200 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      }
    ];

    system.nodeStore.getState().setNodes(initialNodes);

    // Save the graph
    const savedGraph = buildUIGraphJSON(system.session!);

    // Verify viewport is saved
    expect(savedGraph.user?.viewport).toEqual({ x: 50, y: 100, zoom: 1.5 });
  });

  it('should preserve variables when saving and loading', () => {
    // Setup: Create variables
    const variables = {
      var1: {
        id: 'var1',
        name: 'myVariable',
        valueTypeName: 'string',
        initialValue: 'test value'
      }
    };

    system.variableStore.getState().setVariables(variables);

    // Add a node so we have something to save
    const nodes = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 0, y: 0 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      }
    ];
    system.nodeStore.getState().setNodes(nodes);

    // Save the graph
    const savedGraph = buildUIGraphJSON(system.session!);

    // Verify variables are in the flow
    expect(savedGraph.flow.variables).toBeDefined();
    expect(savedGraph.flow.variables?.length).toBe(1);
    expect(savedGraph.flow.variables?.[0].name).toBe('myVariable');

    // Clear variables
    system.variableStore.getState().setVariables({});

    // Load the graph
    system.graph.deseralize(savedGraph);
    system.flowStore.getState().setGraph(savedGraph.flow, { skipLayout: true });

    // Verify variables are restored
    const loadedVariables = system.variableStore.getState().variables;
    expect(Object.keys(loadedVariables)).toHaveLength(1);
    expect(loadedVariables['var1'].name).toBe('myVariable');
  });

  it('should preserve custom events when saving and loading', () => {
    // Setup: Create custom events
    const customEvents = [
      {
        id: 'event1',
        name: 'customEvent',
        parameters: []
      }
    ];

    system.eventsStore.getState().setCustomEvents(customEvents);

    // Add a node so we have something to save
    const nodes = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 0, y: 0 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      }
    ];
    system.nodeStore.getState().setNodes(nodes);

    // Save the graph
    const savedGraph = buildUIGraphJSON(system.session!);

    // Verify custom events are in the flow
    expect(savedGraph.flow.customEvents).toEqual(customEvents);

    // Clear events
    system.eventsStore.getState().setCustomEvents([]);

    // Load the graph
    system.graph.deseralize(savedGraph);
    system.flowStore.getState().setGraph(savedGraph.flow, { skipLayout: true });

    // Verify custom events are restored
    const loadedEvents = system.eventsStore.getState().getCustomEvents();
    expect(loadedEvents).toEqual(customEvents);
  });

  it('should not overwrite node positions when loading with skipLayout', () => {
    // Setup: Create a graph with specific positions
    const nodesWithPositions = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 100, y: 200 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      }
    ];

    system.nodeStore.getState().setNodes(nodesWithPositions);

    // Save the graph
    const savedGraph = buildUIGraphJSON(system.session!);

    // Modify the node position
    system.nodeStore.getState().setNodes([
      {
        ...nodesWithPositions[0],
        position: { x: 999, y: 999 }
      }
    ]);

    // Load the graph with skipLayout
    system.graph.deseralize(savedGraph);
    system.flowStore.getState().setGraph(savedGraph.flow, { skipLayout: true });

    // Verify positions from deseralize are preserved (not overwritten)
    const loadedNodes = system.nodeStore.getState().nodes;
    expect(loadedNodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('should apply auto-layout when loading graph without position metadata', () => {
    // Create a plain GraphJSON without position metadata
    const graphWithoutPositions = {
      nodes: [
        {
          id: 'node1',
          type: 'lifecycle/onStart',
          metadata: {}
        },
        {
          id: 'node2',
          type: 'debug/log',
          metadata: {}
        }
      ],
      variables: [],
      customEvents: []
    };

    // Load the graph (should apply auto-layout)
    system.flowStore.getState().setGraph(graphWithoutPositions);

    // Verify nodes were created with positions (auto-layout applied)
    const loadedNodes = system.nodeStore.getState().nodes;
    expect(loadedNodes).toHaveLength(2);
    expect(loadedNodes[0].position).toBeDefined();
    expect(loadedNodes[1].position).toBeDefined();
    // Auto-layout should set non-zero positions
    const hasLayout = loadedNodes.some(
      (n) => n.position.x !== 0 || n.position.y !== 0
    );
    expect(hasLayout).toBe(true);
  });

  it('should handle round-trip save/load without data loss', () => {
    // Setup a complete graph
    const nodes = [
      {
        id: 'node1',
        type: 'behaveNode',
        position: { x: 100, y: 200 },
        data: {
          type: 'lifecycle/onStart',
          configuration: {},
          ports: {},
          annotations: {}
        }
      },
      {
        id: 'node2',
        type: 'behaveNode',
        position: { x: 300, y: 400 },
        data: {
          type: 'debug/log',
          configuration: { text: { value: 'test' } },
          ports: {},
          annotations: {}
        }
      }
    ];

    const edges = [
      {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        sourceHandle: 'flow',
        targetHandle: 'flow'
      }
    ];

    const variables = {
      var1: {
        id: 'var1',
        name: 'testVar',
        valueTypeName: 'float',
        initialValue: 42
      }
    };

    system.nodeStore.getState().setNodes(nodes);
    system.edgeStore.getState().setEdges(edges);
    system.variableStore.getState().setVariables(variables);

    // Save
    const saved = buildUIGraphJSON(system.session!);

    // Clear
    system.nodeStore.getState().setNodes([]);
    system.edgeStore.getState().setEdges([]);
    system.variableStore.getState().setVariables({});

    // Load
    system.graph.deseralize(saved);
    system.flowStore.getState().setGraph(saved.flow, { skipLayout: true });

    // Verify everything is restored
    const loadedNodes = system.nodeStore.getState().nodes;
    const loadedEdges = system.edgeStore.getState().edges;
    const loadedVars = system.variableStore.getState().variables;

    expect(loadedNodes).toHaveLength(2);
    expect(loadedNodes[0].position).toEqual({ x: 100, y: 200 });
    expect(loadedNodes[1].data.configuration).toEqual({
      text: { value: 'test' }
    });

    expect(loadedEdges).toHaveLength(1);
    expect(loadedEdges[0].source).toBe('node1');
    expect(loadedEdges[0].target).toBe('node2');

    expect(Object.keys(loadedVars)).toHaveLength(1);
    expect(loadedVars['var1'].initialValue).toBe(42);
  });
});
