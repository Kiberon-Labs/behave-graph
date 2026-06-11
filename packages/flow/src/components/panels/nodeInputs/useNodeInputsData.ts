import { useMemo } from 'react';
import { useStore } from 'zustand';
import { configureSockets } from '@/util/sockets';
import { isHandleConnected } from '@/util/isHandleConnected';
import type { IBehaveNode } from '@/types/nodes';
import type { System } from '@/system';

export function useNodeInputsData(system: System) {
  const selectedNodeId = useStore(
    system.selectionStore,
    (x) => x.selectedNodeId
  );
  const nodes = useStore(system.nodeStore, (x) => x.nodes);
  const edges = useStore(system.edgeStore, (x) => x.edges);
  const controls = useStore(system.controlStore, (x) => x.controls);
  const defaultControl = useStore(system.controlStore, (x) => x.defaultControl);
  const generators = useStore(system.socketGeneratorStore, (s) => s.generators);
  const generatorLocation = useStore(
    system.systemSettings,
    (s) => s.generatorLocation
  );

  const allSpecsJson = useStore(system.specStore, (x) => x.specs);

  const selectedNodes = useMemo(() => {
    return nodes.filter(
      (n) => (n as IBehaveNode).type == 'behaveNode' && n.selected
    );
  }, [nodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(
      (n) => (n as IBehaveNode).type === 'behaveNode' && n.id === selectedNodeId
    ) as IBehaveNode | null;
  }, [selectedNodeId, nodes]);

  const nodeSpec = useMemo(() => {
    if (!selectedNode) return null;
    return allSpecsJson.find((spec) => spec.type === selectedNode.data.type);
  }, [selectedNode, allSpecsJson]);

  const inputsWithControls = useMemo(() => {
    if (!selectedNode || !nodeSpec) return [];

    const { pairs, valueInputs } = configureSockets(
      selectedNode.data.configuration,
      nodeSpec,
      selectedNode.data.dynamicPorts
    );
    const inputs: Array<{
      name: string;
      valueType: string;
      defaultValue?: any;
      choices?: Array<{ text: string; value: any }>;
      value: any;
      connected: boolean;
    }> = [];

    for (const [input] of pairs) {
      if (input && input.valueType !== 'flow') {
        inputs.push({
          name: input.name,
          valueType: input.valueType,
          defaultValue: input.defaultValue,
          choices: input.choices,
          value: selectedNode.data.ports?.[input.name] ?? input.defaultValue,
          connected: isHandleConnected(
            edges,
            selectedNode.id,
            input.name,
            'target'
          )
        });
      }
    }

    for (const input of valueInputs) {
      inputs.push({
        name: input.name,
        valueType: input.valueType,
        defaultValue: input.defaultValue,
        choices: input.choices,
        value: selectedNode.data.ports?.[input.name] ?? input.defaultValue,
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

  const outputsWithInfo = useMemo(() => {
    if (!selectedNode || !nodeSpec) return [];

    const { pairs, valueOutputs } = configureSockets(
      selectedNode.data.configuration,
      nodeSpec,
      selectedNode.data.dynamicPorts
    );

    const outputs: Array<{
      name: string;
      valueType: string;
      connected: boolean;
    }> = [];

    // Collect flow-paired outputs (non-flow)
    for (const [, output] of pairs) {
      if (output && output.valueType !== 'flow') {
        outputs.push({
          name: output.name,
          valueType: output.valueType,
          connected: isHandleConnected(
            edges,
            selectedNode.id,
            output.name,
            'source'
          )
        });
      }
    }

    // Value-only outputs
    for (const output of valueOutputs) {
      outputs.push({
        name: output.name,
        valueType: output.valueType,
        connected: isHandleConnected(
          edges,
          selectedNode.id,
          output.name,
          'source'
        )
      });
    }

    return outputs;
  }, [selectedNode, nodeSpec, edges]);

  const matchingGenerators = useMemo(() => {
    if (!nodeSpec || generatorLocation !== 'panel') return [];
    return generators.filter((x) => x.check(nodeSpec));
  }, [nodeSpec, generators, generatorLocation]);

  const generatorNode = useMemo(() => {
    if (!selectedNode || !nodeSpec) return null;
    return {
      id: selectedNode.id,
      data: selectedNode.data,
      spec: nodeSpec,
      selected: !!selectedNode.selected
    };
  }, [selectedNode, nodeSpec]);

  return {
    allSpecsJson,
    selectedNodes,
    selectedNode,
    nodeSpec,
    inputsWithControls,
    outputsWithInfo,

    matchingGenerators,
    generatorNode,
    controls,
    defaultControl
  };
}
