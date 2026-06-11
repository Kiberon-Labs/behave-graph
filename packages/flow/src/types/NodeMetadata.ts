/**
 * Pure metadata types for visual graph editor
 * NO execution code, NO node factories, NO runtime dependencies
 */

import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

export interface ValueTypeMetadata {
  name: string;
  creator: () => any;
  deserialize?: (value: any) => any;
  serialize?: (value: any) => any;
  lerp?: (start: any, end: any, t: number) => any;
  equals?: (a: any, b: any) => boolean;
  clone?: (value: any) => any;
}

/**
 * Pure metadata registry - no execution capabilities
 * Used by the visual graph editor for rendering nodes
 */
export interface INodeRegistry {
  readonly values: Record<string, ValueTypeMetadata>;
  readonly specs: NodeSpecJSON[];
}

export type NodeMetadata = Record<string, string>;
