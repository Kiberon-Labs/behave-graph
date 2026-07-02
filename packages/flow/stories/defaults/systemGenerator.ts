import { System } from '@/system/system';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON,
  type ValueType
} from '@kiberon-labs/behave-graph';

export const ColorValue: ValueType = {
  name: 'color',
  creator: () => '#000000',
  deserialize: (value: string) => value,
  serialize: (value: string) => value,
  lerp: (start: string, end: string, t: number) => (t < 0.5 ? start : end),
  equals: (a: string, b: string) => a === b,
  clone: (value: string) => value
};

// Create the old-style registry for node definitions
let coreRegistry = registerCoreProfile({
  nodes: {},
  values: {
    color: ColorValue
  },
  dependencies: {} as Parameters<typeof registerCoreProfile>[0]['dependencies']
});

// Convert to INodeRegistry
const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
const nodeRegistry = {
  values: coreRegistry.values,
  specs: nodeSpecs
};

//Basic system generator for tests and stories
export const systemGenerator = () => {
  const defaultSys = new System(nodeRegistry);
  defaultSys.createSession('graph');
  return defaultSys;
};
