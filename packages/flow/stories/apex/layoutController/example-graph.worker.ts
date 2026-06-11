/**
 * Example Web Worker for executing behavior graphs
 *
 * This shows the SIMPLEST way to create a custom worker:
 * 1. Set up your registry
 * 2. Import the reference implementation
 * 3. That's it!
 */

import {
  registerCoreProfile,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import { initializeGraphWorker } from '@/plugin/graphrunner-webworker/graph-executor.worker.js';
import type { ValueType } from '@kiberon-labs/behave-graph';

// ============================================================================
// STEP 1: Set up your registry with your custom nodes
// ============================================================================

const ColorValue: ValueType = {
  name: 'color',
  creator: () => '#000000',
  deserialize: (value: string) => value,
  serialize: (value: string) => value,
  lerp: (start: string, end: string, t: number) => (t < 0.5 ? start : end),
  equals: (a: string, b: string) => a === b,
  clone: (value: string) => value
};

const registry: IRegistry = registerCoreProfile({
  nodes: {},
  values: {
    color: ColorValue
  },
  dependencies: {}
});

initializeGraphWorker({ registry });
