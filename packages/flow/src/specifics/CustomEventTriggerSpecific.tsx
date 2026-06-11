import React, { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';

import { useSystem } from '@/system/provider';
import type { SpecificRenderProps } from '@/store/specific';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { Socket } from '@/types';
import type { IBehaveNode } from '@/types/nodes';

const NAME = 'customEvent/trigger.customEventId';

export function getCustomEventTriggerSpecific() {
  return {
    name: NAME,
    check: (spec: NodeSpecJSON) => spec?.type === 'customEvent/trigger',
    render: CustomEventTriggerSpecific
  };
}

const CustomEventTriggerSpecific: React.FC<SpecificRenderProps> = ({
  node
}) => {
  const system = useSystem();
  const customEvents = useStore(system.eventsStore, (s) => s.customEvents);

  const options = useMemo(() => {
    return Object.values(customEvents)
      .map((evt: any) => ({
        id: evt?.id === undefined || evt?.id === null ? '' : String(evt.id),
        name:
          evt?.name === undefined || evt?.name === null ? '' : String(evt.name),
        parameters: evt?.parameters ?? []
      }))
      .filter((x) => x.id);
  }, [customEvents]);

  const value = useMemo(() => {
    const v = node.data.configuration?.customEventId;
    return v === undefined || v === null ? '' : String(v);
  }, [node.data]);

  const setNodeConfigValue = useCallback(
    (nextValue: string) => {
      // Allow clearing the selection
      if (!nextValue) {
        system.nodeStore.getState().setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== node.id) return n;
            return {
              ...n,
              data: {
                ...n.data,
                configuration: {
                  ...n.data?.configuration,
                  customEventId: ''
                }
              }
            };
          })
        );
        return;
      }

      const selectedEvent = options.find((opt) => opt.id === nextValue);
      if (!selectedEvent) return;

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          // Build input ports based on event parameters
          const parameterInputs = (selectedEvent.parameters ?? []).reduce(
            (
              acc: Record<string, Socket>,
              param: { name: string; valueTypeName: string }
            ) => {
              acc[param.name] = {
                name: param.name || 'value',
                key: param.name || 'value',
                valueType: param.valueTypeName || 'string'
              };
              return acc;
            },
            {}
          );

          // Update configuration and ports with the selected event

          const updatedNode = {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data?.configuration,
                customEventId: nextValue
              },
              dynamicPorts: {
                ...n.data?.dynamicPorts,
                inputs: Object.values(parameterInputs)
              }
            }
          } as IBehaveNode;

          return updatedNode;
        })
      );
    },
    [node.id, system, options]
  );

  return (
    <div style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Event</div>
      <VscodeSingleSelect
        value={value}
        onChange={(e: any) =>
          setNodeConfigValue(String(e?.target?.value ?? ''))
        }
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <VscodeOption value="">No custom events</VscodeOption>
        ) : (
          <>
            <VscodeOption value="">Select an event...</VscodeOption>
            {options.map((opt) => (
              <VscodeOption key={opt.id} value={opt.id}>
                {opt.name ? `${opt.name}` : `Event ${opt.id}`}
                {opt.parameters.length > 0 &&
                  ` (${opt.parameters.length} param${opt.parameters.length > 1 ? 's' : ''})`}
              </VscodeOption>
            ))}
          </>
        )}
      </VscodeSingleSelect>
    </div>
  );
};
