import type { Choices } from '@kiberon-labs/behave-graph';

export const GeometryType = {
  Box: 'box',
  Sphere: 'sphere',
  Cylinder: 'cylinder',
  Torus: 'torus',
  Plane: 'plane',
  Cone: 'cone'
} as const;

export type GeometryType = (typeof GeometryType)[keyof typeof GeometryType];

export const LightType = {
  Point: 'point',
  Directional: 'directional',
  Spot: 'spot',
  Ambient: 'ambient'
} as const;

export type LightType = (typeof LightType)[keyof typeof LightType];

export interface IScene {
  // --- existing property accessors ---
  getProperty(jsonPath: string, valueTypeName: string): unknown;
  setProperty(jsonPath: string, valueTypeName: string, value: unknown): void;
  addOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void;
  removeOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void;
  getRaycastableProperties: () => Choices;
  getProperties: (valueFilter?: string) => Choices;
  addOnSceneChangedListener(listener: () => void): void;
  removeOnSceneChangedListener(listener: () => void): void;

  // --- mesh lifecycle ---
  createMesh(
    name: string,
    geometryType: GeometryType,
    size: { x: number; y: number; z: number }
  ): void;
  deleteMesh(name: string): void;
  getMeshNames: () => Choices;

  // --- lighting ---
  addLight(
    name: string,
    lightType: LightType,
    color: { r: number; g: number; b: number },
    intensity: number
  ): void;
  removeLight(name: string): void;
  setLightProperty(name: string, property: string, value: unknown): void;
  getLightProperty(name: string, property: string): unknown;
  getLightNames: () => Choices;

  // --- material ---
  setMaterialProperty(meshName: string, property: string, value: unknown): void;
  getMaterialProperty(meshName: string, property: string): unknown;

  // --- global click (returns which mesh was hit) ---
  addOnAnyMeshClickedListener(callback: (meshName: string) => void): void;
  removeOnAnyMeshClickedListener(callback: (meshName: string) => void): void;

  // --- spatial helpers ---
  getMeshPosition(
    meshName: string
  ): { x: number; y: number; z: number } | undefined;
  setMeshPosition(
    meshName: string,
    position: { x: number; y: number; z: number }
  ): void;
  getDistanceBetween(meshA: string, meshB: string): number;
  lookAt(meshName: string, target: { x: number; y: number; z: number }): void;
  moveTowards(
    meshName: string,
    target: { x: number; y: number; z: number },
    speed: number,
    deltaSeconds: number
  ): boolean; // returns true when arrived

  // --- mesh utilities ---
  cloneMesh(sourceName: string, newName: string): void;
  setMeshVisible(meshName: string, visible: boolean): void;
}
