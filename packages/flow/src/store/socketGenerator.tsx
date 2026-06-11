import type { IBehaveNode } from '@/types/nodes';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { ComponentType } from 'react';
import { create } from 'zustand';

export type SocketGeneratorNode = {
  id: string;
  data: IBehaveNode['data'];
  spec: NodeSpecJSON;
  selected: boolean;
};

export type SocketGeneratorRenderProps = {
  node: SocketGeneratorNode;
};

export type SocketGenerator = {
  name: string;
  check: (spec: NodeSpecJSON) => boolean;
  render: ComponentType<SocketGeneratorRenderProps>;
};

export type SocketGeneratorStore = {
  generators: SocketGenerator[];
  registerGenerator: (generator: SocketGenerator) => void;
  unregisterGenerator: (name: string) => void;
};

export const socketGeneratorStoreFactory = () =>
  create<SocketGeneratorStore>((set) => ({
    generators: [],

    registerGenerator: (generator) =>
      set((state) => {
        const existingIndex = state.generators.findIndex(
          (x) => x.name === generator.name
        );

        if (existingIndex === -1) {
          return {
            generators: [...state.generators, generator]
          };
        }

        const next = state.generators.slice();
        next[existingIndex] = generator;
        return { generators: next };
      }),

    unregisterGenerator: (name) =>
      set((state) => ({
        generators: state.generators.filter((x) => x.name !== name)
      }))
  }));
