import {
  validateValueRegistry,
  registerCoreProfile,
  validateNodeRegistry,
  type IRegistry
} from '@kiberon-labs/behave-graph';

import { registerSceneProfile } from '../src/registerSceneProfile.js';
import { describe, test, expect } from 'vitest';

describe('scene profile', () => {
  let registry: IRegistry = {
    nodes: {},
    values: {},
    dependencies: {
      IScene: null
    }
  };
  registry = registerCoreProfile(registry);
  registry = registerSceneProfile(registry);

  test('validate node registry', () => {
    expect(validateNodeRegistry(registry)).toHaveLength(0);
  });
  test('validate value registry', () => {
    expect(validateValueRegistry(registry.values)).toHaveLength(0);
  });

  const valueTypeNameToExampleValues: { [key: string]: any[] } = {
    vec2: ['(0,0)', '1,0', '(100,-60.0)', { x: 0, y: 0 }, { x: -60, y: 100 }],
    vec3: [
      '(0,0,0)',
      '1,0,0',
      '100,-60.0,40',
      { x: 0, y: 0, z: 1 },
      { x: -60, y: 100, z: 0 }
    ],
    vec4: [
      '(0,0,0,0)',
      '1,0,0,0',
      '(100,-60.0,40,-9e9)',
      { x: 0, y: 0, z: 1, w: 2 },
      { x: -60, y: 100, z: 0, w: -10 }
    ]
  };

  for (const valueTypeName in valueTypeNameToExampleValues) {
    test(`${valueTypeName} serialization/deserialization`, () => {
      const valueType = registry.values[valueTypeName]!;

      const exampleValues: any[] = valueTypeNameToExampleValues[valueTypeName]!;
      exampleValues.forEach((exampleValue: any) => {
        const deserializedValue = valueType.deserialize(exampleValue);
        const serializedValue = valueType.serialize(deserializedValue);
        const redeserializedValue = valueType.deserialize(serializedValue);
        const reserializedValue = valueType.serialize(redeserializedValue);

        expect(serializedValue).toStrictEqual(reserializedValue);
      });
    });
  }
});
