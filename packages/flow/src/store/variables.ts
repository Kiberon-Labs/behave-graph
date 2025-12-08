import type { GraphVariables, Variable } from '@kinforge/behave-graph';
import { create } from 'zustand';

export type VariableStore = {
  variables: GraphVariables;
  setVariable: (key: string, value: Variable) => void;
  removeVariable: (key: string) => void;
};

export const variableStoreFactory = () =>
  create<VariableStore>((set) => ({
    variables: {},
    setVariable: (key: string, value: Variable) =>
      set((state) => ({
        variables: {
          ...state.variables,
          [key]: value
        }
      })),
    removeVariable: (key: string) =>
      set((state) => {
        const newVariables = { ...state.variables };
        delete newVariables[key];
        return { variables: newVariables };
      })
  }));
