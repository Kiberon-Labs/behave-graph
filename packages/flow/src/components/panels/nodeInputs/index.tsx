import React, { useMemo } from 'react';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { configureSockets } from '@/util/sockets';
import { writeNodeSpecsToJSON } from '@kinforge/behave-graph';
import { isHandleConnected } from '@/util/isHandleConnected';
import type { BehaveNode } from '@/types';

export function NodeInputsPanel() {
  const system = useSystem();
  const selectedNodeId = useStore(
    system.selectionStore,
    (x) => x.selectedNodeId
  );
  const nodes = useStore(system.nodeStore, (x) => x.nodes);
  const edges = useStore(system.edgeStore, (x) => x.edges);
  const controls = useStore(system.controlStore, (x) => x.controls);
  const defaultControl = useStore(system.controlStore, (x) => x.defaultControl);

  // Get all node specs as JSON
  const allSpecsJson = useMemo(() => {
    return writeNodeSpecsToJSON(system.registry);
  }, [system.registry]);

  // Find all selected nodes
  const selectedNodes = useMemo(() => {
    return nodes.filter(
      (n) => (n as BehaveNode).type == 'behaveNode' && n.selected
    );
  }, [nodes]);

  // Find the selected node (for single selection)
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(
      (n) => (n as BehaveNode).type === 'behaveNode' && n.id === selectedNodeId
    );
  }, [selectedNodeId, nodes]);

  // Get the spec for the selected node
  const nodeSpec = useMemo(() => {
    if (!selectedNode) return null;
    return allSpecsJson.find((spec) => spec.type === selectedNode.data.type);
  }, [selectedNode, allSpecsJson]);

  // Get the input sockets that should have controls
  const inputsWithControls = useMemo(() => {
    if (!selectedNode || !nodeSpec) return [];

    const { pairs, valueInputs } = configureSockets(
      selectedNode.data.ports,
      nodeSpec
    );

    // Collect all inputs that are not flow inputs
    const inputs: Array<{
      name: string;
      valueType: string;
      defaultValue?: any;
      choices?: Array<{ text: string; value: any }>;
      value: any;
      connected: boolean;
    }> = [];

    // From pairs, get the input sockets (non-flow)
    for (const [input] of pairs) {
      if (input && input.valueType !== 'flow') {
        inputs.push({
          name: input.name,
          valueType: input.valueType,
          defaultValue: input.defaultValue,
          choices: input.choices,
          value: selectedNode.data.ports[input.name] ?? input.defaultValue,
          connected: isHandleConnected(
            edges,
            selectedNode.id,
            input.name,
            'target'
          )
        });
      }
    }

    // Add value inputs
    for (const input of valueInputs) {
      inputs.push({
        name: input.name,
        valueType: input.valueType,
        defaultValue: input.defaultValue,
        choices: input.choices,
        value: selectedNode.data.ports[input.name] ?? input.defaultValue,
        connected: isHandleConnected(
          edges,
          selectedNode.id,
          input.name,
          'target'
        )
      });
    }

    return inputs;
  }, [selectedNode, nodeSpec, edges]);

  // Handle value changes
  const handleValueChange = (inputName: string, newValue: any) => {
    if (!selectedNode) return;

    // Update the node data
    const updatedNode = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        ports: {
          ...selectedNode.data.ports,
          [inputName]: newValue
        }
      }
    };

    // Update in the node store
    const allNodes = system.nodeStore.getState().nodes;
    const updatedNodes = allNodes.map((n) =>
      n.id === selectedNode.id ? updatedNode : n
    );
    system.nodeStore.getState().setNodes(updatedNodes);
  };

  // Handle multiple node selection
  if (selectedNodes.length > 1) {
    return (
      <div className="flex-col gap-2 h-100 flex-1 p-2">
        <h3
          style={{
            fontSize: '1.1em',
            fontWeight: 'bold',
            marginBottom: 'var(--component-spacing-xs)'
          }}
        >
          Multiple Nodes Selected ({selectedNodes.length})
        </h3>
        <div className="flex-col gap-1">
          {selectedNodes.map((node) => {
            const spec = allSpecsJson.find((s) => s.type === node.type);
            return (
              <div
                key={node.id}
                className="p-2"
                style={{
                  border: '1px solid var(--color-neutral-stroke-subtle)',
                  borderRadius: 'var(--component-spacing-xs)'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>
                  {spec?.label || node.type}
                </div>
                <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                  ID: {node.id}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!selectedNode || !nodeSpec) {
    return (
      <div className="flex-col gap-2 h-100 flex-1 p-2">
        <div
          style={{
            fontSize: '0.9em',
            fontStyle: 'italic',
            opacity: 0.7,
            textAlign: 'center',
            padding: '2rem'
          }}
        >
          No node selected. Select a node to edit its inputs.
        </div>
      </div>
    );
  }

  if (inputsWithControls.length === 0) {
    return (
      <div className="flex-col gap-2 h-100 flex-1 p-2">
        <h3
          style={{
            fontSize: '1.1em',
            fontWeight: 'bold',
            marginBottom: 'var(--component-spacing-xs)'
          }}
        >
          {nodeSpec.label}
        </h3>
        <div
          style={{
            fontSize: '0.9em',
            fontStyle: 'italic',
            opacity: 0.7
          }}
        >
          This node has no editable inputs.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-2 h-100 flex-1 p-2 mb-1">
      <h3
        style={{
          fontSize: '1.1em',
          fontWeight: 'bold'
        }}
      >
        {nodeSpec.label}
      </h3>

      <div className="flex-col gap-2">
        {inputsWithControls.map((input) => {
          const ControlComponent = controls[input.valueType] ?? defaultControl;

          return (
            <div key={input.name} className="flex-col gap-1 p-2">
              <label
                style={{
                  fontSize: '0.9em',
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}
              >
                {input.name}
              </label>
              <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                Type: {input.valueType}
              </div>

              {input.connected ? (
                <div
                  style={{
                    fontSize: '0.9em',
                    fontStyle: 'italic',
                    opacity: 0.7,
                    padding: '0.5rem'
                  }}
                >
                  Socket is connected
                </div>
              ) : input.choices && input.choices.length > 0 ? (
                <select
                  className="nodrag bg-gray-600 py-1 px-2 disabled:bg-gray-700"
                  value={input.value ?? ''}
                  onChange={(e) =>
                    handleValueChange(input.name, e.currentTarget.value)
                  }
                  style={{ width: '100%' }}
                >
                  {input.choices.map((choice) => (
                    <option key={choice.text} value={choice.value}>
                      {choice.text}
                    </option>
                  ))}
                </select>
              ) : (
                <ControlComponent
                  value={input.value}
                  onChange={(newValue) =>
                    handleValueChange(input.name, newValue)
                  }
                  valueType={input.valueType}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
