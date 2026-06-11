import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { useSystem } from '@/system/provider';
import type { SocketGeneratorRenderProps } from '@/store/socketGenerator';
import type { Socket } from '@/types';
import type { IBehaveNode } from '@/types/nodes.js';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph/Graphs/IO/NodeSpecJSON';

const NAME = 'customEvent/onTriggered.socketGenerator';

export function getCustomEventOnTriggeredGenerator() {
  return {
    name: NAME,
    check: (spec: NodeSpecJSON) => spec?.type === 'customEvent/onTriggered',
    render: CustomEventOnTriggeredGenerator
  };
}

const CustomEventOnTriggeredGenerator: React.FC<SocketGeneratorRenderProps> = ({
  node
}) => {
  const system = useSystem();
  const customEvents = useStore(system.eventsStore, (s) => s.customEvents);

  const customEventId = node.data.configuration?.customEventId;

  useEffect(() => {
    // Find the selected custom event
    const event = customEvents[customEventId];

    if (!event) {
      // No event selected or event not found - clear parameter outputs
      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              dynamicPorts: {
                ...n.data?.dynamicPorts,
                outputs: []
              }
            }
          };
        })
      );
      return;
    }

    // Generate output sockets based on event parameters (not including flow)
    const outputs: Socket[] = [];

    // Add output for each parameter
    if (event.parameters && Array.isArray(event.parameters)) {
      event.parameters.forEach((param: any) => {
        outputs.push({
          name: param.name || 'param',
          key: param.name || 'param',
          valueType: param.valueTypeName || 'string'
        });
      });
    }

    // Update node ports
    system.nodeStore.getState().setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            dynamicPorts: {
              ...n.data?.dynamicPorts,
              outputs
            }
          }
        } as IBehaveNode;
      })
    );
  }, [customEventId, customEvents, node.id, system.nodeStore]);

  // This generator doesn't render any UI
  return null;
};
