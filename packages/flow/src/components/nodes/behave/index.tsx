import type { NodeProps } from 'reactflow';
import { Node } from './Node';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import type { IBehaveNode } from '@/types/nodes.js';

export const BehaveNode = (props: NodeProps<IBehaveNode['data']>) => {
  const sys = useSystem();
  const allSpecs = useStore(sys.specStore, (s) => s.specs);
  const specDict = useStore(sys.specStore, (s) => s.specDict);
  return (
    <Node spec={specDict[props.data.type]!} allSpecs={allSpecs} {...props} />
  );
};
