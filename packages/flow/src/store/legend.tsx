import {
  Cube,
  Droplet,
  EaseCurveControlPoints,
  Hashtag,
  InputOutput,
  SelectPoint3d,
  Text
} from 'iconoir-react';
import { create } from 'zustand';

export type LegendStore = {
  icons: Record<string, React.ComponentType>;
  defaultIcon: React.ComponentType;
  valueTypeColors: Record<string, string>;
  categoryColors: Record<string, string>;
  setIcon: (key: string, icon: React.ComponentType) => void;
  setValueTypeColor: (key: string, color: string) => void;
  setCategoryColor: (key: string, color: string) => void;
};

export const legendStoreFactory = () =>
  create<LegendStore>((set) => ({
    // store the component references (not instantiated elements)
    defaultIcon: SelectPoint3d,
    categoryColors: {
      Event: '#f14445',
      Logic: '#16a34a',
      Variable: '#a855f7',
      Query: '#a855f7',
      Action: '#0891b2',
      Flow: '#6c727e',
      Effect: '#84cc16',
      Time: '#6c727e',
      None: '#6c727e'
    },
    valueTypeColors: {
      flow: '#ffffff',
      number: '#16a34a',
      float: '#16a34a',
      integer: '#84cc16',
      boolean: '#0891b2',
      string: '#a855f7',
      object: '#f97316'
    },
    icons: {
      color: Droplet,
      curve: EaseCurveControlPoints,
      string: Text,
      boolean: InputOutput,
      float: Hashtag,
      integer: Hashtag,
      object: Cube
    },
    setIcon: (key: string, icon: React.ComponentType) =>
      set((state) => ({
        icons: {
          ...state.icons,
          [key]: icon
        }
      })),
    setValueTypeColor: (key: string, color: string) =>
      set((state) => ({
        valueTypeColors: {
          ...state.valueTypeColors,
          [key]: color
        }
      })),
    setCategoryColor: (key: string, color: string) =>
      set((state) => ({
        categoryColors: {
          ...state.categoryColors,
          [key]: color
        }
      }))
  }));
