import type { VariableJSON } from '@kiberon-labs/behave-graph';

import { create } from 'zustand';

type GraphVariables = {
  [key: string]: VariableJSON;
};

export type VariableStore = {
  variables: GraphVariables;
  setVariable: (key: string, value: VariableJSON) => void;
  setVariables: (variables: GraphVariables) => void;
  removeVariable: (key: string) => void;
};

export const variableStoreFactory = () =>
  create<VariableStore>((set) => ({
    variables: {},
    setVariables: (variables: GraphVariables) =>
      set(() => ({
        variables
      })),
    setVariable: (key: string, value: VariableJSON) => {
      set((state) => ({
        variables: {
          ...state.variables,
          [key]: value
        }
      }));
    },
    removeVariable: (key: string) =>
      set((state) => {
        const newVariables = { ...state.variables };
        delete newVariables[key];
        return { variables: newVariables };
      })
  }));
