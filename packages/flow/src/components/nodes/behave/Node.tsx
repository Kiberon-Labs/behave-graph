import type { NodeSpecJSON } from '@kinforge/behave-graph';
import React, { useCallback, useMemo, useState } from 'react';
import { useEdges, type NodeProps as FlowNodeProps } from 'reactflow';

import { useChangeNodeData } from '../../../hooks/useChangeNodeData.js';
import { isHandleConnected } from '../../../util/isHandleConnected.js';
import InputSocket from '../../InputSocket.js';
import NodeContainer from './NodeContainer.js';
import OutputSocket from '../../OutputSocket.js';
import { configureSockets } from '@/util/sockets.js';
import { BaseNodeWrapper } from '../wrapper/index.js';

type NodeProps = FlowNodeProps & {
  spec: NodeSpecJSON;
  allSpecs: NodeSpecJSON[];
};

export const Node: React.FC<NodeProps> = ({
  id,
  data,
  spec,
  selected,
  allSpecs
}: NodeProps) => {
  const edges = useEdges();
  const handleChange = useChangeNodeData(id);
  const [socketsVisible, setSocketsVisible] = useState(true);

  const { pairs, valueInputs } = useMemo(
    () => configureSockets(data.ports, spec),
    [data.ports, spec]
  );

  return (
    <BaseNodeWrapper metadata={data.annotations}>
      <NodeContainer
        title={spec.label}
        category={spec.category}
        selected={selected}
      >
        {pairs.map(([input, output], ix) => (
          <div
            key={ix}
            className="flex flex-row justify-between gap-8 relative px-2"
          >
            {input && (
              <InputSocket
                {...input}
                specJSON={allSpecs}
                value={data.ports[input.name] ?? input.defaultValue}
                onChange={handleChange}
                connected={isHandleConnected(edges, id, input.name, 'target')}
              />
            )}
            {output && (
              <OutputSocket
                {...output}
                specJSON={allSpecs}
                connected={isHandleConnected(edges, id, output.name, 'source')}
              />
            )}
          </div>
        ))}
        {valueInputs.map((input, ix) => (
          <div
            key={`valueInput-${ix}`}
            className="flex flex-row justify-start gap-8 relative px-2"
          >
            <InputSocket
              key={`valueInput-${input.name}`}
              {...input}
              specJSON={allSpecs}
              hide={!socketsVisible}
              value={data.ports[input.name] ?? input.defaultValue}
              onChange={handleChange}
              connected={isHandleConnected(edges, id, input.name, 'target')}
              nodeId={id}
            />
          </div>
        ))}
      </NodeContainer>
    </BaseNodeWrapper>
  );
};
