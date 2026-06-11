import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { ComponentType } from 'react';
import { create } from 'zustand';
import { getCustomEventOnTriggeredSpecific } from '@/specifics/CustomEventOnTriggeredSpecific';
import { getCustomEventTriggerSpecific } from '@/specifics/CustomEventTriggerSpecific';
import { getVariableGetSpecific } from '@/specifics/VariableGetSpecific';
import { getVariableSetSpecific } from '@/specifics/VariableSetSpecific';
import type { IBehaveNode } from '@/types/nodes';

export type SpecificNode = {
  id: string;
  data: IBehaveNode['data'];
  spec: NodeSpecJSON;
  selected: boolean;
};

export type SpecificRenderProps = {
  node: SpecificNode;
};

export type Specific = {
  name: string;
  check: (spec: NodeSpecJSON) => boolean;
  render: ComponentType<SpecificRenderProps>;
};

export type SpecificStore = {
  specifics: Specific[];
  titleBarActions: Record<string, React.ReactElement>;
  registerSpecific: (specific: Specific) => void;
  unregisterSpecific: (name: string) => void;
  registryTitleBarAction: (name: string, action: React.ReactElement) => void;
};

const defaultSpecifics: Specific[] = [
  getCustomEventOnTriggeredSpecific(),
  getCustomEventTriggerSpecific(),
  getVariableGetSpecific(),
  getVariableSetSpecific()
];

export const specificStoreFactory = () =>
  create<SpecificStore>((set) => ({
    specifics: defaultSpecifics,

    registerSpecific: (specific) =>
      set((state) => {
        const existingIndex = state.specifics.findIndex(
          (x) => x.name === specific.name
        );

        if (existingIndex === -1) {
          return {
            specifics: [...state.specifics, specific]
          };
        }

        const next = state.specifics.slice();
        next[existingIndex] = specific;
        return { specifics: next };
      }),

    unregisterSpecific: (name) =>
      set((state) => ({
        specifics: state.specifics.filter((x) => x.name !== name)
      })),
    titleBarActions: {},
    registryTitleBarAction: (name: string, action: React.ReactElement) =>
      set((state) => ({
        titleBarActions: {
          ...state.titleBarActions,
          [name]: action
        }
      }))
  }));
