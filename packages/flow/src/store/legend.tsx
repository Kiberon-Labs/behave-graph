import { Cube, Droplet, EaseCurveControlPoints, Hashtag, InputOutput, SelectPoint3d, Text } from 'iconoir-react';
import { create } from 'zustand';


export type LegendStore = {
  icons: Record<string, React.ComponentType>;
  defaultIcon: React.ComponentType
  valueTypeColors: Record<string, string>
};

export const legendStoreFactory = () =>
  create<LegendStore>((set) => ({
    // store the component references (not instantiated elements)
    defaultIcon: SelectPoint3d,
    valueTypeColors: {
      flow: 'white',
      number: 'green',
      float: 'green',
      integer: 'lime',
      boolean: 'red',
      string: 'purple'
    },
    icons: {
      color: Droplet,
      curve: EaseCurveControlPoints,
      string: Text,
      boolean: InputOutput,
      float: Hashtag,
      integer: Hashtag,
      object: Cube,
    },

  }));
