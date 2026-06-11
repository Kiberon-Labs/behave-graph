import React, { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';

import { useSystem } from '@/system/provider';
import type { SpecificRenderProps } from '@/store/specific';

const NAME = 'customEvent/onTriggered.customEventId';

export function getCustomEventOnTriggeredSpecific() {
  return {
    name: NAME,
    check: (spec: any) => spec?.type === 'customEvent/onTriggered',
    render: CustomEventOnTriggeredSpecific
  };
}

const CustomEventOnTriggeredSpecific: React.FC<SpecificRenderProps> = ({
  node
}) => {
  const system = useSystem();
  const customEvents = useStore(system.eventsStore, (s) => s.customEvents);

  const options = useMemo(() => {
    return Object.values(customEvents)
      .map((evt) => ({
        id: evt.id === undefined || evt.id === null ? '' : String(evt.id),
        name:
          evt.name === undefined || evt.name === null ? '' : String(evt.name)
      }))
      .filter((x) => x.id);
  }, [customEvents]);

  const value = useMemo(() => {
    const v = node.data?.configuration?.customEventId;
    return v === undefined || v === null ? '' : String(v);
  }, [node.data]);

  const setNodeConfigValue = (nextValue: string) => {
    system.nodeStore.getState().setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            configuration: {
              ...n.data?.configuration,
              customEventId: nextValue
            }
          }
        };
      })
    );
  };

  useEffect(() => {
    if (value) return;
    const first = options[0];
    if (!first) return;
    setNodeConfigValue(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, node.id]);

  return (
    <div style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
        customEventId
      </div>
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
          options.map((opt) => (
            <VscodeOption key={opt.id} value={opt.id}>
              {opt.name ? `${opt.name} (${opt.id})` : opt.id}
            </VscodeOption>
          ))
        )}
      </VscodeSingleSelect>
    </div>
  );
};
