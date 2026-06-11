/**
 * Registers the built-in MCP tools on the McpRegistry.
 *
 * Each tool is a standalone registration: a McpToolDefinition
 * (metadata) plus a handler function. Plugins can add more tools
 * by calling `registry.registerTool(...)` directly.
 */
import type { System } from '@kiberon-labs/behave-graph-flow';
import type { McpRegistry } from './mcpRegistry';

/**
 * Register all built-in MCP tools on the given registry.
 * Called during MCP plugin initialisation.
 */
export function registerBuiltinTools(
  registry: McpRegistry,
  system: System
): void {
  registerInspectionTools(registry, system);
  registerAuthoringTools(registry, system);
  registerVariableTools(registry, system);
  registerEventTools(registry, system);
  registerEditorTools(registry, system);
  registerExecutionTools(registry, system);
}

// -----------------------------------------------------------
// Inspection tools
// -----------------------------------------------------------

function registerInspectionTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'get_graph',
      title: 'Get Graph',
      description:
        'Returns the current graph as GraphJSON. Includes all nodes, ' +
        'edges, variables, custom events, and metadata.',
      category: 'inspection',
      tags: ['graph', 'read', 'json', 'export'],
      command: 'mcp:getGraph'
    },
    () => system.flowStore.getState().getGraph()
  );

  registry.registerTool(
    {
      name: 'get_node',
      title: 'Get Node',
      description:
        'Returns detailed information about a specific node by its ID, ' +
        'including its type, configuration, parameters, and connections.',
      category: 'inspection',
      tags: ['node', 'read', 'detail', 'connections'],
      inputSchema: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to retrieve'
        }
      },
      command: 'mcp:getNode'
    },
    (args) => {
      const nodeId = args.nodeId as string;
      if (!nodeId) throw new Error('nodeId is required');

      const nodes = system.nodeStore.getState().nodes;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);

      const edges = system.edgeStore.getState().edges;
      const connectedEdges = edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        selected: node.selected,
        connections: connectedEdges.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle
        }))
      };
    }
  );

  registry.registerTool(
    {
      name: 'list_node_types',
      title: 'List Node Types',
      description:
        'Returns an array of all available node type specifications ' +
        '(NodeSpecJSON). Each spec describes inputs, outputs, ' +
        'configuration, category, and label. Use the "type" field ' +
        'when calling add_node.',
      category: 'inspection',
      tags: ['node', 'types', 'search', 'catalog'],
      inputSchema: {
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. "math", "flow", "logic")'
        },
        search: {
          type: 'string',
          description: 'Optional search string to filter by type or label'
        }
      },
      command: 'mcp:listNodeTypes'
    },
    (args) => {
      const category = args.category as string | undefined;
      const search = args.search as string | undefined;

      let specs = system.specStore.getState().specs;

      if (category) {
        const lowerCat = category.toLowerCase();
        specs = specs.filter((s) =>
          s.category?.toLowerCase().includes(lowerCat)
        );
      }

      if (search) {
        const lowerSearch = search.toLowerCase();
        specs = specs.filter(
          (s) =>
            s.type.toLowerCase().includes(lowerSearch) ||
            s.label?.toLowerCase().includes(lowerSearch)
        );
      }

      return specs;
    }
  );

  registry.registerTool(
    {
      name: 'search_node_types',
      title: 'Search Node Types',
      description:
        'Full-text search across all node type specifications. ' +
        'Matches against type identifier, label, category, tags, ' +
        'and description. Returns ranked results with the most ' +
        'relevant specs first. More focused than list_node_types ' +
        'when you know what you are looking for.',
      category: 'inspection',
      tags: ['node', 'types', 'search', 'catalog', 'find'],
      inputSchema: {
        query: {
          type: 'string',
          description:
            'Search query matched against type, label, category, tags, and description'
        },
        category: {
          type: 'string',
          description:
            'Optional category filter applied after text search ' +
            '(e.g. "math", "flow", "logic")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)'
        }
      },
      command: 'mcp:searchNodeTypes'
    },
    (args) => {
      const query = (args.query as string | undefined) ?? '';
      const category = args.category as string | undefined;
      const limit = (args.limit as number | undefined) ?? 20;

      let specs = system.specStore.getState().specs;

      if (category) {
        const lowerCat = category.toLowerCase();
        specs = specs.filter((s) =>
          s.category?.toLowerCase().includes(lowerCat)
        );
      }

      if (!query.trim()) {
        return specs.slice(0, limit);
      }

      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      type ScoredSpec = { score: number; spec: (typeof specs)[number] };

      const scored: ScoredSpec[] = specs.flatMap((spec) => {
        const fields = [
          spec.type ?? '',
          spec.label ?? '',
          spec.category ?? '',
          ...(Array.isArray((spec as Record<string, unknown>).tags)
            ? ((spec as Record<string, unknown>).tags as string[])
            : []),
          ((spec as Record<string, unknown>).description as string) ?? ''
        ].map((f) => f.toLowerCase());

        let score = 0;
        for (const term of terms) {
          for (const [fieldIndex, field] of fields.entries()) {
            if (!field.includes(term)) continue;
            // Exact token match in type or label scores highest
            const weight = fieldIndex === 0 ? 4 : fieldIndex === 1 ? 3 : 1;
            score += field === term ? weight * 2 : weight;
          }
        }

        return score > 0 ? [{ score, spec }] : [];
      });

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, limit).map((s) => s.spec);
    }
  );

  registry.registerTool(
    {
      name: 'get_selected_nodes',
      title: 'Get Selected Nodes',
      description:
        'Returns the IDs and types of all currently selected nodes ' +
        'in the editor.',
      category: 'inspection',
      tags: ['node', 'selection', 'read', 'editor'],
      command: 'mcp:getSelectedNodes'
    },
    () => {
      const nodes = system.nodeStore.getState().nodes;
      const selected = nodes.filter((n) => n.selected);
      return selected.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        position: n.position
      }));
    }
  );
}

// -----------------------------------------------------------
// Authoring tools
// -----------------------------------------------------------

function registerAuthoringTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'add_node',
      title: 'Add Node',
      description:
        'Adds a new node to the graph. Use list_node_types to find ' +
        'available types. Returns the new node ID.',
      category: 'authoring',
      tags: ['node', 'create', 'write'],
      inputSchema: {
        nodeType: {
          type: 'string',
          description:
            'The node type identifier (e.g. "math/add", "flow/branch")'
        },
        positionX: {
          type: 'number',
          description: 'X position in the graph canvas (default: 0)'
        },
        positionY: {
          type: 'number',
          description: 'Y position in the graph canvas (default: 0)'
        }
      },
      command: 'mcp:addNode'
    },
    (args) => {
      const nodeType = args.nodeType as string;
      if (!nodeType) throw new Error('nodeType is required');

      const position = {
        x: (args.positionX as number) ?? 0,
        y: (args.positionY as number) ?? 0
      };

      const nodeId = crypto.randomUUID();

      const newNode = {
        id: nodeId,
        type: 'behaveNode',
        position,
        data: {
          configuration: {},
          type: nodeType,
          ports: {},
          dynamicPorts: {}
        }
      };

      system.nodeStore.getState().addNode(newNode);

      return { nodeId, nodeType, position };
    }
  );

  registry.registerTool(
    {
      name: 'remove_node',
      title: 'Remove Node',
      description: 'Removes a node from the graph by its ID.',
      category: 'authoring',
      tags: ['node', 'delete', 'write'],
      inputSchema: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to remove'
        }
      },
      command: 'mcp:removeNode'
    },
    (args) => {
      const nodeId = args.nodeId as string;
      if (!nodeId) throw new Error('nodeId is required');

      system.actionStore.getState().actions.deleteNodes([nodeId]);

      return { removed: nodeId };
    }
  );

  registry.registerTool(
    {
      name: 'connect_nodes',
      title: 'Connect Nodes',
      description:
        'Creates an edge (connection) between two node sockets. ' +
        'Use get_node to see available socket names.',
      category: 'authoring',
      tags: ['edge', 'connection', 'create', 'write'],
      inputSchema: {
        sourceNodeId: {
          type: 'string',
          description: 'The ID of the source node'
        },
        sourceSocket: {
          type: 'string',
          description: 'The name of the output socket on the source node'
        },
        targetNodeId: {
          type: 'string',
          description: 'The ID of the target node'
        },
        targetSocket: {
          type: 'string',
          description: 'The name of the input socket on the target node'
        }
      },
      command: 'mcp:connectNodes'
    },
    (args) => {
      const sourceNodeId = args.sourceNodeId as string;
      const sourceSocket = args.sourceSocket as string;
      const targetNodeId = args.targetNodeId as string;
      const targetSocket = args.targetSocket as string;

      if (!sourceNodeId || !sourceSocket || !targetNodeId || !targetSocket) {
        throw new Error(
          'sourceNodeId, sourceSocket, targetNodeId, and targetSocket are all required'
        );
      }

      const edgeId = crypto.randomUUID();
      const edge = {
        id: edgeId,
        source: sourceNodeId,
        sourceHandle: sourceSocket,
        target: targetNodeId,
        targetHandle: targetSocket
      };

      system.edgeStore.getState().addEdge(edge);

      return { edgeId, ...edge };
    }
  );

  registry.registerTool(
    {
      name: 'disconnect_nodes',
      title: 'Disconnect Nodes',
      description:
        'Removes an edge by its ID, or by specifying the ' +
        'source and target node/socket pairs.',
      category: 'authoring',
      tags: ['edge', 'connection', 'delete', 'write'],
      inputSchema: {
        edgeId: {
          type: 'string',
          description: 'The ID of the edge to remove'
        },
        sourceNodeId: {
          type: 'string',
          description: 'The ID of the source node'
        },
        sourceSocket: {
          type: 'string',
          description: 'The output socket name on the source node'
        },
        targetNodeId: {
          type: 'string',
          description: 'The ID of the target node'
        },
        targetSocket: {
          type: 'string',
          description: 'The input socket name on the target node'
        }
      },
      command: 'mcp:disconnectNodes'
    },
    (args) => {
      const edgeId = args.edgeId as string | undefined;
      const sourceNodeId = args.sourceNodeId as string | undefined;
      const sourceSocket = args.sourceSocket as string | undefined;
      const targetNodeId = args.targetNodeId as string | undefined;
      const targetSocket = args.targetSocket as string | undefined;

      const edges = system.edgeStore.getState().edges;
      let edgeToRemove: (typeof edges)[number] | undefined;

      if (edgeId) {
        edgeToRemove = edges.find((e) => e.id === edgeId);
      } else if (sourceNodeId && sourceSocket && targetNodeId && targetSocket) {
        edgeToRemove = edges.find(
          (e) =>
            e.source === sourceNodeId &&
            e.sourceHandle === sourceSocket &&
            e.target === targetNodeId &&
            e.targetHandle === targetSocket
        );
      }

      if (!edgeToRemove) {
        throw new Error('Edge not found with the given parameters');
      }

      const removedId = edgeToRemove.id;
      system.edgeStore
        .getState()
        .setEdges(edges.filter((e) => e.id !== removedId));

      return { removed: removedId };
    }
  );

  registry.registerTool(
    {
      name: 'set_parameter',
      title: 'Set Parameter',
      description:
        'Sets the value of an input parameter on a node. ' +
        'Use get_node to see available parameters.',
      category: 'authoring',
      tags: ['node', 'parameter', 'value', 'write'],
      inputSchema: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node'
        },
        inputName: {
          type: 'string',
          description: 'The name of the input socket/parameter'
        },
        value: {
          description: 'The value to set (type depends on the socket)'
        }
      },
      command: 'mcp:setParameter'
    },
    (args) => {
      const nodeId = args.nodeId as string;
      const inputName = args.inputName as string;
      const value = args.value;

      if (!nodeId || !inputName) {
        throw new Error('nodeId and inputName are required');
      }

      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              ports: {
                ...node.data.ports,
                [inputName]: value
              }
            }
          };
        })
      );

      return { nodeId, inputName, value };
    }
  );

  registry.registerTool(
    {
      name: 'set_configuration',
      title: 'Set Configuration',
      description:
        'Sets a configuration value on a node. Configuration affects ' +
        'node behaviour and available sockets.',
      category: 'authoring',
      tags: ['node', 'configuration', 'write'],
      inputSchema: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node'
        },
        configKey: {
          type: 'string',
          description: 'The configuration key to set'
        },
        value: {
          description: 'The configuration value'
        }
      },
      command: 'mcp:setConfiguration'
    },
    (args) => {
      const nodeId = args.nodeId as string;
      const configKey = args.configKey as string;
      const value = args.value;

      if (!nodeId || !configKey) {
        throw new Error('nodeId and configKey are required');
      }

      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              configuration: {
                ...node.data.configuration,
                [configKey]: value
              }
            }
          };
        })
      );

      return { nodeId, configKey, value };
    }
  );
}

// -----------------------------------------------------------
// Variable tools
// -----------------------------------------------------------

function registerVariableTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'create_variable',
      title: 'Create Variable',
      description: 'Creates a new graph variable.',
      category: 'variables',
      tags: ['variable', 'create', 'write'],
      inputSchema: {
        name: {
          type: 'string',
          description: 'Human-readable variable name'
        },
        valueTypeName: {
          type: 'string',
          description:
            'The value type (e.g. "string", "float", "integer", "boolean")'
        },
        initialValue: {
          description: 'The initial value for the variable'
        }
      },
      command: 'mcp:createVariable'
    },
    (args) => {
      const name = args.name as string;
      const valueTypeName = args.valueTypeName as string;
      const initialValue = args.initialValue;

      if (!name || !valueTypeName) {
        throw new Error('name and valueTypeName are required');
      }

      const variableId = crypto.randomUUID();
      system.variableStore.getState().setVariable(variableId, {
        id: variableId,
        name,
        valueTypeName,
        initialValue: initialValue ?? null
      });

      return { variableId, name, valueTypeName };
    }
  );

  registry.registerTool(
    {
      name: 'remove_variable',
      title: 'Remove Variable',
      description: 'Removes a graph variable by its ID.',
      category: 'variables',
      tags: ['variable', 'delete', 'write'],
      inputSchema: {
        variableId: {
          type: 'string',
          description: 'The ID of the variable to remove'
        }
      },
      command: 'mcp:removeVariable'
    },
    (args) => {
      const variableId = args.variableId as string;
      if (!variableId) throw new Error('variableId is required');

      system.variableStore.getState().removeVariable(variableId);

      return { removed: variableId };
    }
  );
}

// -----------------------------------------------------------
// Custom event tools
// -----------------------------------------------------------

function registerEventTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'create_custom_event',
      title: 'Create Custom Event',
      description: 'Creates a new custom event with optional parameters.',
      category: 'events',
      tags: ['event', 'create', 'write', 'custom'],
      inputSchema: {
        name: {
          type: 'string',
          description: 'Human-readable event name'
        },
        parameters: {
          type: 'array',
          description: 'Optional array of event parameters',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Parameter name'
              },
              valueTypeName: {
                type: 'string',
                description: 'Parameter type (e.g. "string", "float")'
              },
              defaultValue: {
                description: 'Default value'
              }
            },
            required: ['name', 'valueTypeName']
          }
        }
      },
      command: 'mcp:createCustomEvent'
    },
    (args) => {
      const name = args.name as string;
      const parameters = args.parameters as
        | Array<{
            name: string;
            valueTypeName: string;
            defaultValue?: unknown;
          }>
        | undefined;

      if (!name) throw new Error('name is required');

      const eventId = crypto.randomUUID();
      system.eventsStore.getState().addCustomEvent({
        id: eventId,
        name,
        parameters: parameters ?? []
      });

      return { eventId, name };
    }
  );

  registry.registerTool(
    {
      name: 'remove_custom_event',
      title: 'Remove Custom Event',
      description: 'Removes a custom event by its ID.',
      category: 'events',
      tags: ['event', 'delete', 'write', 'custom'],
      inputSchema: {
        eventId: {
          type: 'string',
          description: 'The ID of the custom event to remove'
        }
      },
      command: 'mcp:removeCustomEvent'
    },
    (args) => {
      const eventId = args.eventId as string;
      if (!eventId) throw new Error('eventId is required');

      system.eventsStore.getState().removeCustomEvent(eventId);

      return { removed: eventId };
    }
  );
}

// -----------------------------------------------------------
// Editor tools
// -----------------------------------------------------------

function registerEditorTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'save_graph',
      title: 'Save Graph',
      description:
        'Saves the current graph to disk. Triggers the VS Code save.',
      category: 'editor',
      tags: ['save', 'persist', 'file'],
      command: 'mcp:saveGraph'
    },
    async () => {
      const uiGraph = await system.actionStore.getState().actions.save();
      return { saved: true, name: uiGraph.name };
    }
  );

  registry.registerTool(
    {
      name: 'layout_graph',
      title: 'Layout Graph',
      description:
        'Auto-layouts all nodes in the graph for better readability.',
      category: 'editor',
      tags: ['layout', 'arrange', 'visual'],
      command: 'mcp:layoutGraph'
    },
    () => {
      const graphJson = system.flowStore.getState().getGraph();
      if (graphJson.nodes) {
        for (const node of graphJson.nodes) {
          if (node.metadata) {
            delete node.metadata.positionX;
            delete node.metadata.positionY;
          }
        }
      }
      system.flowStore.getState().setGraph(graphJson);
      return { layout: 'applied' };
    }
  );

  registry.registerTool(
    {
      name: 'select_nodes',
      title: 'Select Nodes',
      description: 'Selects specific nodes in the editor by their IDs.',
      category: 'editor',
      tags: ['node', 'selection', 'visual'],
      inputSchema: {
        nodeIds: {
          type: 'array',
          description: 'Array of node IDs to select',
          items: { type: 'string' }
        }
      },
      command: 'mcp:selectNodes'
    },
    (args) => {
      const nodeIds = args.nodeIds as string[];
      if (!nodeIds || !Array.isArray(nodeIds)) {
        throw new Error('nodeIds array is required');
      }

      const nodeIdSet = new Set(nodeIds);
      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: nodeIdSet.has(node.id)
        }))
      );

      return { selected: nodeIds };
    }
  );
}

// -----------------------------------------------------------
// Execution tools
// -----------------------------------------------------------

function registerExecutionTools(registry: McpRegistry, system: System): void {
  registry.registerTool(
    {
      name: 'run_graph',
      title: 'Run Graph',
      description:
        'Starts execution of the current graph via the graph runner.',
      category: 'execution',
      tags: ['run', 'play', 'execute'],
      command: 'mcp:runGraph'
    },
    () => {
      const runner = system.runner;
      if (!runner) {
        throw new Error('Graph runner is not available');
      }
      runner.play();
      return { status: 'running' };
    }
  );

  registry.registerTool(
    {
      name: 'stop_graph',
      title: 'Stop Graph',
      description: 'Stops the currently running graph execution.',
      category: 'execution',
      tags: ['stop', 'halt', 'execute'],
      command: 'mcp:stopGraph'
    },
    () => {
      const runner = system.runner;
      if (!runner) {
        throw new Error('Graph runner is not available');
      }
      runner.stop();
      return { status: 'stopped' };
    }
  );
}
