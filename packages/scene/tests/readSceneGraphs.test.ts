import * as colorJson from './graphs/logic/Color.json';
import * as eulerJson from './graphs/logic/Euler.json';
import * as quaternionJson from './graphs/logic/Quaternion.json';
import * as vector2Json from './graphs/logic/Vector2.json';
import * as vector3Json from './graphs/logic/Vector3.json';
import * as vector4Json from './graphs/logic/Vector4.json';
import {
  readGraphFromJSON,
  validateGraphLinks,
  registerCoreProfile,
  validateGraphAcyclic,
  type IRegistry,
  type GraphInstance,
  type GraphJSON
} from '@kinforge/behave-graph';
import { registerSceneProfile } from '@/registerSceneProfile.js';
import { describe, test, expect } from 'vitest';

let registry: IRegistry = {
  nodes: {},
  values: {},
  dependencies: {}
};
registry = registerCoreProfile(registry);
registry = registerSceneProfile(registry);

const exampleMap: { [key: string]: any } = {
  vector2Json,
  vector3Json,
  vector4Json,
  quaternionJson,
  colorJson,
  eulerJson
};

for (const key in exampleMap) {
  describe(`${key}`, () => {
    const exampleJson = exampleMap[key] as GraphJSON;

    let parsedGraphJson: GraphInstance | undefined;
    test('parse json to graph', () => {
      expect(() => {
        parsedGraphJson = readGraphFromJSON({
          graphJson: exampleJson,
          registry
        });
      }).not.toThrow();
      // await fs.writeFile('./examples/test.json', JSON.stringify(writeGraphToJSON(graph), null, ' '), { encoding: 'utf-8' });
      if (parsedGraphJson !== undefined) {
        expect(validateGraphLinks(parsedGraphJson.nodes)).toHaveLength(0);
        expect(validateGraphAcyclic(parsedGraphJson.nodes)).toHaveLength(0);
      } else {
        expect(parsedGraphJson).toBeDefined();
      }
    });
  });
}
