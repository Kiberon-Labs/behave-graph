import { Cube, Droplet, EaseCurveControlPoints, Hashtag, InputOutput, SelectPoint3d, Text } from 'iconoir-react';
import { create } from 'zustand';


export type ControlsStore = {
    icons: Record<string, React.ComponentType>;
};

export const controlsStoreFactory = () =>
    create<ControlsStore>((set) => ({
        // store the component references (not instantiated elements)
        defaultIcon: SelectPoint3d,
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
