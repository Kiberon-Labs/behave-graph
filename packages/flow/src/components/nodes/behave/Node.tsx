import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import { useMemo, useState } from 'react';
import { useEdges, type NodeProps } from 'reactflow';
import { useStore } from 'zustand';
import { useChangeNodeData } from '../../../hooks/useChangeNodeData.js';
import { isHandleConnected } from '../../../util/isHandleConnected.js';
import InputSocket from '../../sockets/input/index.js';
import NodeContainer from './NodeContainer.js';
import OutputSocket from '../../sockets/output/index.js';
import { configureSockets } from '@/util/sockets.js';
import { BaseNodeWrapper } from '../wrapper/index.js';
import { useSystem } from '@/system/provider.js';
import type { SpecificNode } from '@/store/specific';
import type { SocketGeneratorNode } from '@/store/socketGenerator';
import styles from './Node.module.css';
import type { IBehaveNode } from '@/types/nodes.js';

export type BehaveNodeProps = NodeProps<IBehaveNode['data']> & {
  spec: NodeSpecJSON;
  allSpecs: NodeSpecJSON[];
};

export const Node = ({
  id,
  data,
  spec,
  selected,
  allSpecs
}: BehaveNodeProps) => {
  const system = useSystem();
  const edges = useEdges();
  const handleChange = useChangeNodeData(id);
  const [socketsVisible, _setSocketsVisible] = useState(true);
  const specifics = useStore(system.specificStore, (s) => s.specifics);
  const titleBarActions = useStore(
    system.specificStore,
    (s) => s.titleBarActions
  );
  const generators = useStore(system.socketGeneratorStore, (s) => s.generators);
  const generatorLocation = useStore(
    system.systemSettings,
    (s) => s.generatorLocation
  );

  // Early return if spec is not available yet
  if (!spec) {
    return null;
  }

  const { pairs, valueInputs } = useMemo(
    () => configureSockets(data.configuration, spec, data.dynamicPorts),
    [data.configuration, spec, data.dynamicPorts]
  );

  const matchingSpecifics = useMemo(() => {
    if (!spec) return [];
    return specifics.filter((x) => x.check(spec));
  }, [spec, specifics]);

  const matchingGenerators = useMemo(() => {
    if (!spec || generatorLocation !== 'inline') return [];
    return generators.filter((x) => x.check(spec));
  }, [spec, generators, generatorLocation]);

  const specificNode: SpecificNode = useMemo(
    () => ({
      id,
      data,
      spec,
      selected: !!selected
    }),
    [data, id, selected, spec]
  );

  const generatorNode: SocketGeneratorNode = useMemo(
    () => ({
      id,
      data,
      spec,
      selected: !!selected
    }),
    [data, id, selected, spec]
  );

  const hiddenInputs = useMemo(() => {
    return data.annotations?.hiddenInputs ?? {};
  }, [data.annotations]);

  const hiddenOutputs = useMemo(() => {
    return data.annotations?.hiddenOutputs ?? {};
  }, [data.annotations]);

  const shouldShowInput = (inputName: string) => {
    const isConnected = isHandleConnected(edges, id, inputName, 'target');
    const isHidden = hiddenInputs[inputName] ?? false;
    return !isHidden || isConnected;
  };

  const shouldShowOutput = (outputName: string) => {
    const isConnected = isHandleConnected(edges, id, outputName, 'source');
    const isHidden = hiddenOutputs[outputName] ?? false;
    return !isHidden || isConnected;
  };

  return (
    <BaseNodeWrapper metadata={data.annotations}>
      <NodeContainer
        title={spec.label}
        category={spec.category}
        selected={selected}
        titleBarActions={titleBarActions[spec.type]}
      >
        {pairs.map(([input, output], ix) => {
          const showInput = !input || shouldShowInput(input.name);
          const showOutput = !output || shouldShowOutput(output.name);
          if (!showInput && !showOutput) return null;
          return (
            <div key={ix} className={styles.pairRow}>
              {input && (
                <InputSocket
                  {...input}
                  hide={!showInput}
                  specJSON={allSpecs}
                  value={input.defaultValue}
                  onChange={handleChange}
                  connected={isHandleConnected(edges, id, input.name, 'target')}
                />
              )}
              {output && (
                <OutputSocket
                  {...output}
                  hide={!showOutput}
                  specJSON={allSpecs}
                  connected={isHandleConnected(
                    edges,
                    id,
                    output.name,
                    'source'
                  )}
                />
              )}
            </div>
          );
        })}
        {valueInputs.map((input, ix) => {
          if (!shouldShowInput(input.name)) return null;

          return (
            <div key={`valueInput-${ix}`} className={styles.valueInputRow}>
              <InputSocket
                {...input}
                specJSON={allSpecs}
                hide={!socketsVisible}
                value={input.defaultValue}
                onChange={handleChange}
                connected={isHandleConnected(edges, id, input.name, 'target')}
              />
            </div>
          );
        })}

        {matchingGenerators.map((generator) => {
          const GeneratorRenderer = generator.render;
          return (
            <GeneratorRenderer key={generator.name} node={generatorNode} />
          );
        })}

        {matchingSpecifics.map((specific) => {
          const SpecificRenderer = specific.render;
          return <SpecificRenderer key={specific.name} node={specificNode} />;
        })}
      </NodeContainer>
    </BaseNodeWrapper>
  );
};
