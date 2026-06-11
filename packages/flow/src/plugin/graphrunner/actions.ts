import type { System } from '../../system/system';
import type { StoreApi } from 'zustand';
import type { GraphRunnerClientStore } from './store';
import type { GraphRunnerClient } from './client';
import { executing } from '@/annotations';
import { sleep } from '@/util/sleep';
import { type ValueJSON } from '@kiberon-labs/behave-graph';

// Helper to clear executing state from all nodes
async function clearAllExecutingStates(system: System) {
  await sleep(1); // Delay to allow any final traces to process
  system.nodeStore.getState().setNodes((nodes) =>
    nodes.map((node) => {
      if ('data' in node && node.data.annotations?.[executing]) {
        return {
          ...node,
          data: {
            ...node.data,
            annotations: {
              ...node.data.annotations,
              [executing]: false
            }
          }
        };
      }
      return node;
    })
  );
}

/**
 * Setup persistent event listeners on the client for trace, logs, and run lifecycle
 * This should be called once when the client is connected
 */
export function setupClientEventListeners(
  client: GraphRunnerClient,
  system: System,
  store: StoreApi<GraphRunnerClientStore>
) {
  const { setIsExecuting, setCurrentRunId, setCurrentGraphId, setIsPaused } =
    store.getState();

  // Listen for trace events - these apply to all runs
  client.on('trace', async (message) => {
    const traceStore = system.traceStore.getState();
    if (message.event === 'start') {
      let name = message.nodeId;
      if (
        message.data &&
        typeof message.data === 'object' &&
        'typeName' in message.data
      ) {
        const typeName = (message.data as { typeName?: unknown }).typeName;
        if (typeof typeName === 'string') {
          name = typeName;
        }
      }
      traceStore.addSpan({
        nodeId: message.nodeId,
        name,
        start: message.timestamp || performance.now(),
        end: 1,
        lane: 0
      });

      // Mark node as executing
      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) =>
          node.id === message.nodeId && 'data' in node
            ? {
                ...node,
                data: {
                  ...node.data,
                  annotations: {
                    ...node.data.annotations,
                    [executing]: true
                  }
                }
              }
            : node
        )
      );
    } else if (message.event === 'end') {
      traceStore.updateSpan(message.nodeId, {
        end: message.timestamp || performance.now()
      });

      //Delay to allow UI to show executing state
      await sleep(1);

      // Mark node as no longer executing
      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) =>
          node.id === message.nodeId && 'data' in node
            ? {
                ...node,
                data: {
                  ...node.data,
                  annotations: {
                    ...node.data.annotations,
                    [executing]: false
                  }
                }
              }
            : node
        )
      );
    }
  });

  // Listen for log messages
  client.on('log', (message) => {
    const logStore = system.logsStore.getState();
    const formattedMessage = `[${message.runId}/${message.graphId}] ${message.message}${message.data !== undefined ? ` ${JSON.stringify(message.data)}` : ''}`;
    logStore.append({
      time: new Date(),
      data: {
        message: formattedMessage
      },
      type: message.level as any
    });
  });

  // Listen for variable change events from server
  client.on('variableChanged', (message) => {
    const variableStore = system.variableStore.getState();
    const id = message.variableName;

    // Get existing variable or create new one
    const existingVariable = variableStore.variables[id];

    if (existingVariable) {
      // Update existing variable
      system.variableStore.getState().setVariable(id, {
        ...existingVariable,
        initialValue: message.newValue as ValueJSON
      });
    } else {
      // Create new variable if it doesn't exist
      const inferredType = typeof message.newValue;
      const newVariable = {
        id,
        name: message.variableName,
        valueTypeName: inferredType === 'object' ? 'string' : inferredType,
        initialValue: message.newValue as ValueJSON
      };
      variableStore.setVariable(id, newVariable);
    }
  });

  // Listen for run completion events
  client.on('completed', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.success(`Graph completed: ${message.graphId}`);
      setIsExecuting(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      setIsPaused(false);
      clearAllExecutingStates(system);
    }
  });

  client.on('error', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.error(`Graph failed: ${message.graphId}`);
      setIsExecuting(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      setIsPaused(false);
      clearAllExecutingStates(system);
    }
  });

  client.on('stopped', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.info(`Graph stopped: ${message.graphId}`);
      setIsExecuting(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      setIsPaused(false);
      clearAllExecutingStates(system);
    }
  });

  // Realtime state change listeners
  client.on('nodeRemoved', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      // Update node store to reflect removal
      system.nodeStore
        .getState()
        .setNodes((nodes) =>
          nodes.filter((node) => node.id !== message.nodeId)
        );
      system.notifications.info(`Node removed: ${message.nodeId}`);
    }
  });

  client.on('linkCreated', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.info(
        `Link created: ${message.fromNodeId}/${message.fromSocket} -> ${message.toNodeId}/${message.toSocket}`
      );
    }
  });

  client.on('linkRemoved', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.info(
        `Link removed: ${message.fromNodeId}/${message.fromSocket} -> ${message.toNodeId}/${message.toSocket}`
      );
    }
  });

  client.on('nodeParamUpdated', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      system.notifications.info(`Parameter updated on ${message.nodeId}`);
    }
  });

  client.on('affectedNodes', (message) => {
    const currentRunId = store.getState().currentRunId;
    if (message.runId === currentRunId) {
      // Highlight affected nodes
      system.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) => {
          if (message.nodeIds.includes(node.id)) {
            return {
              ...node,
              data: {
                ...node.data,
                annotations: {
                  ...node.data?.annotations,
                  [executing]: true
                }
              }
            };
          }
          return node;
        })
      );
      system.notifications.info(
        `Executing ${message.reason}: ${message.nodeIds.length} node(s)`
      );
    }
  });
}
