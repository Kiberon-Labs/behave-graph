import { AnyControl } from '@/components/controls/any';
import { BooleanControl } from '@/components/controls/boolean';
import { NumberControl } from '@/components/controls/number';
import { StringControl } from '@/components/controls/string';
import { ColorControl } from '@/components/controls/colorPicker';
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

export interface ControlProps<T = any> {
  value: T;
  onChange: (value: T) => void;
  valueType?: string;
}

export type ControlComponent<T = any> = React.FC<ControlProps<T>>;

export type ControlsStore = {
  icons: Record<string, React.ComponentType>;
  controls: Record<string, React.FC<ControlProps>>;
  defaultControl: React.FC<ControlProps>;
  registerControl: (name: string, control: React.FC<ControlProps>) => void;
};

export const controlsStoreFactory = () =>
  create<ControlsStore>((set) => ({
    // store the component references (not instantiated elements)
    defaultIcon: SelectPoint3d,

    defaultControl: AnyControl,
    controls: {
      color: ColorControl,
      string: StringControl,
      number: NumberControl,
      float: NumberControl,
      integer: NumberControl,
      boolean: BooleanControl
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
    registerControl: (name: string, control: React.FC<ControlProps>) =>
      set((state) => ({
        controls: {
          ...state.controls,
          [name]: control
        }
      }))
  }));
