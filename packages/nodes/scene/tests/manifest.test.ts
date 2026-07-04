import {
  ContributionKind,
  parseManifest,
  runManifestSource
} from '@kiberon-labs/behave-graph';
import manifestSource from '../src/manifest.source.js';
import { describe, test, expect } from 'vitest';

describe('scene package manifest', () => {
  test('generates a valid manifest from the source (no IScene driver, no node exec)', async () => {
    const manifest = await runManifestSource(manifestSource);
    expect(parseManifest(manifest).ok).toBe(true);
    expect(manifest.package.name).toBe('@kiberon-labs/behave-graph-scene');
    expect(manifest.categories).toEqual(['effect']);
    expect(manifest.runtime).toBe('./index.js');
    expect(manifest.nodes.length).toBeGreaterThan(100);
  });

  test('carries every scene value type with function-free JSON defaults', async () => {
    const manifest = await runManifestSource(manifestSource);
    const byName = Object.fromEntries(
      manifest.values.map((v) => [v.name, v.defaultJSON])
    );
    expect(Object.keys(byName).sort()).toEqual([
      'color',
      'euler',
      'mat3',
      'mat4',
      'quat',
      'vec2',
      'vec3',
      'vec4'
    ]);
    expect(byName.vec3).toEqual([0, 0, 0]);
    // identity matrix
    expect(byName.mat4).toEqual([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
    ]);
    // No functions leak into the manifest.
    manifest.values.forEach((v) =>
      Object.values(v).forEach((field) =>
        expect(typeof field).not.toBe('function')
      )
    );
  });

  test('declares the vec3 control and a value-type contribution per scene type', async () => {
    const manifest = await runManifestSource(manifestSource);
    const control = manifest.contributions.find(
      (c) => c.kind === ContributionKind.Control
    );
    expect(control?.export).toBe('./ui/controls/vec3.js#Vec3Control');
    expect(control?.bind?.controlName).toBe('vec3');

    const valueTypeContribs = manifest.contributions.filter(
      (c) => c.kind === ContributionKind.ValueType
    );
    expect(valueTypeContribs).toHaveLength(8);
    // Every declared value-type contribution binds to a value the manifest carries.
    const valueNames = new Set(manifest.values.map((v) => v.name));
    valueTypeContribs.forEach((c) =>
      expect(valueNames.has(c.bind?.valueType ?? '')).toBe(true)
    );
  });
});
