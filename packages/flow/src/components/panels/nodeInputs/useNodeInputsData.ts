import { useMemo } from 'react';
import { useStore } from 'zustand';
import { configureSockets } from '@/util/sockets';
import { isHandleConnected } from '@/util/isHandleConnected';
import type { IBehaveNode } from '@/types/nodes';
import type { GraphSession } from '@/system/graphSession';

export function useNodeInputsData(system: GraphSession) {
  const selectedNodeId = useStore(
    system.selectionStore,
    (x) => x.selectedNodeId
  );
  const nodes = useStore(system.nodeStore, (x) => x.nodes);
  const edges = useStore(system.edgeStore, (x) => x.edges);
  const controls = useStore(system.controlStore, (x) => x.controls);
  const defaultControl = useStore(system.controlStore, (x) => x.defaultControl);
  const generators = useStore(
    system.editor.socketGeneratorStore,
    (s) => s.generators
  );
  const generatorLocation = useStore(
    system.editor.systemSettings,
    (s) => s.generatorLocation
  );

  const allSpecsJson = useStore(system.editor.specStore, (x) => x.specs);

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

    // `valueOutputs` already contains every non-flow output. (The `pairs` from
    // configureSockets also carry these value outputs in their second slot ,
    // iterating both would render each value output twice and collide on the
    // React key, e.g. `provider` / `agent`.)
    const { valueOutputs } = configureSockets(
      selectedNode.data.configuration,
      nodeSpec,
      selectedNode.data.dynamicPorts
    );

    return valueOutputs.map((output) => ({
      name: output.name,
      valueType: output.valueType,
      connected: isHandleConnected(
        edges,
        selectedNode.id,
        output.name,
        'source'
      )
    }));
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
