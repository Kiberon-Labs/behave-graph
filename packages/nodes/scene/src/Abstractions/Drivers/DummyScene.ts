import {
  BooleanValue,
  EventEmitter,
  FloatValue,
  IntegerValue,
  StringValue,
  type ValueType
} from '@kiberon-labs/behave-graph';

import { ColorValue } from '../../Values/ColorValue.js';
import { EulerValue } from '../../Values/EulerValue.js';
import { QuatValue } from '../../Values/QuatValue.js';
import { Vec2Value } from '../../Values/Vec2Value.js';
import { Vec3Value } from '../../Values/Vec3Value.js';
import { Vec4Value } from '../../Values/Vec4Value.js';
import type { GeometryType, IScene, LightType } from '../IScene.js';

export class DummyScene implements IScene {
  public onSceneChanged = new EventEmitter<void>();

  private valueRegistry: Record<string, ValueType>;

  constructor() {
    this.valueRegistry = Object.fromEntries(
      [
        BooleanValue,
        StringValue,
        IntegerValue,
        FloatValue,
        Vec2Value,
        Vec3Value,
        Vec4Value,
        ColorValue,
        EulerValue,
        QuatValue
      ].map((valueType) => [valueType.name, valueType])
    );
    // pull in value type nodes
  }

  getProperty(jsonPath: string, valueTypeName: string): unknown {
    return this.valueRegistry[valueTypeName]?.creator();
  }
  setProperty(): void {
    this.onSceneChanged.emit();
  }
  addOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void {
    console.log('added on clicked listener');
  }
  removeOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void {
    console.log('removed on clicked listener');
  }

  getQueryableProperties() {
    return [];
  }

  getRaycastableProperties() {
    return [];
  }

  getProperties() {
    return [];
  }

  addOnSceneChangedListener() {
    console.log('added on scene changed listener');
  }

  removeOnSceneChangedListener(): void {
    console.log('removed on scene changed listener');
  }

  // --- mesh lifecycle ---
  createMesh(
    _name: string,
    _geometryType: GeometryType,
    _size: { x: number; y: number; z: number }
  ): void {
    console.log('created mesh (dummy)');
  }

  deleteMesh(_name: string): void {
    console.log('deleted mesh (dummy)');
  }

  getMeshNames() {
    return [];
  }

  // --- lighting ---
  addLight(
    _name: string,
    _lightType: LightType,
    _color: { r: number; g: number; b: number },
    _intensity: number
  ): void {
    console.log('added light (dummy)');
  }

  removeLight(_name: string): void {
    console.log('removed light (dummy)');
  }

  setLightProperty(_name: string, _property: string, _value: unknown): void {
    console.log('set light property (dummy)');
  }

  getLightProperty(_name: string, _property: string): unknown {
    return undefined;
  }

  getLightNames() {
    return [];
  }

  // --- material ---
  setMaterialProperty(
    _meshName: string,
    _property: string,
    _value: unknown
  ): void {
    console.log('set material property (dummy)');
  }

  getMaterialProperty(_meshName: string, _property: string): unknown {
    return undefined;
  }

  // --- global click ---
  addOnAnyMeshClickedListener(_callback: (meshName: string) => void): void {
    console.log('added on any mesh clicked listener (dummy)');
  }

  removeOnAnyMeshClickedListener(_callback: (meshName: string) => void): void {
    console.log('removed on any mesh clicked listener (dummy)');
  }

  // --- spatial helpers ---
  getMeshPosition(
    _meshName: string
  ): { x: number; y: number; z: number } | undefined {
    return { x: 0, y: 0, z: 0 };
  }

  setMeshPosition(
    _meshName: string,
    _position: { x: number; y: number; z: number }
  ): void {
    console.log('set mesh position (dummy)');
  }

  getDistanceBetween(_meshA: string, _meshB: string): number {
    return 0;
  }

  lookAt(
    _meshName: string,
    _target: { x: number; y: number; z: number }
  ): void {
    console.log('lookAt (dummy)');
  }

  moveTowards(
    _meshName: string,
    _target: { x: number; y: number; z: number },
    _speed: number,
    _deltaSeconds: number
  ): boolean {
    return true;
  }

  // --- mesh utilities ---
  cloneMesh(_sourceName: string, _newName: string): void {
    console.log('cloned mesh (dummy)');
  }

  setMeshVisible(_meshName: string, _visible: boolean): void {
    console.log('set mesh visible (dummy)');
  }
}
