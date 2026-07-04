import {
  ContributionKind,
  PackageCategory,
  defineManifestSource,
  type ContributionSpec,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { getSceneNodesMap, getSceneValuesMap } from './registerSceneProfile.js';
import { DummyScene } from './Abstractions/Drivers/DummyScene.js';
import pkg from '../package.json' with { type: 'json' };

/**
 * Build-time manifest source for the scene package.
 *
 * The registry projects scene's own nodes + value types into static specs
 * (instantiation only — nodes are never run, no IScene driver needed). The
 * executable profile (`registerSceneProfile`) lives behind the `runtime` entry,
 * loaded only by a runner. Contributions point into the built `dist`: the vec3
 * input control, plus each scene value type so a trusted host can swap the
 * editor's pass-through implementations for the real serializers.
 */

// (file, export, valueType name) for each scene value type.
const valueTypeContributions: ContributionSpec[] = [
  ['Vec2Value', 'vec2'],
  ['Vec3Value', 'vec3'],
  ['Vec4Value', 'vec4'],
  ['ColorValue', 'color'],
  ['EulerValue', 'euler'],
  ['QuatValue', 'quat'],
  ['Mat3Value', 'mat3'],
  ['Mat4Value', 'mat4']
].map(([exportName, valueType]) => ({
  id: `${valueType}-value`,
  kind: ContributionKind.ValueType,
  export: `./Values/${exportName}.js#${exportName}`,
  bind: { valueType }
}));

export default defineManifestSource({
  package: { name: pkg.name, version: pkg.version },
  registry: () => ({
    nodes: getSceneNodesMap(),
    values: getSceneValuesMap(),
    // The DummyScene driver satisfies IScene-dependent nodes during spec
    // generation (it never runs them); the real driver is host-provided at run
    // time. Without it, scene-property nodes log "IScene not registered".
    dependencies: { IScene: new DummyScene() } as unknown as Dependencies
  }),
  runtime: './index.js',
  categories: [PackageCategory.Effect],
  contributions: [
    {
      id: 'vec3-control',
      kind: ContributionKind.Control,
      export: './ui/controls/vec3.js#Vec3Control',
      bind: { controlName: 'vec3' }
    },
    ...valueTypeContributions
  ]
});
