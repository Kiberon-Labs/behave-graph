import { describe, it, expect } from 'vitest';
import {
  ContributionKind,
  parseManifest,
  runManifestSource
} from '@kiberon-labs/behave-graph';
import manifestSource from '../src/manifest.source.js';

describe('image package manifest', () => {
  it('generates a valid manifest from the source (no WASM, no node exec)', async () => {
    const manifest = await runManifestSource(manifestSource);
    expect(parseManifest(manifest).ok).toBe(true);
    expect(manifest.package.name).toBe(
      '@kiberon-labs/behave-graph-nodes-image'
    );
    expect(manifest.categories).toEqual(['effect']);
    expect(manifest.runtime).toBe('./index.js');
  });

  it('describes every image node statically', async () => {
    const manifest = await runManifestSource(manifestSource);
    const types = manifest.nodes.map((n) => n.type);
    expect(types).toContain('image/blur');
    expect(types).toContain('image/preview');
    expect(types).toHaveLength(71);
    const blur = manifest.nodes.find((n) => n.type === 'image/blur');
    expect(blur?.inputs.map((i) => i.name)).toEqual([
      'image',
      'radius',
      'sigma'
    ]);
  });

  it('carries a function-free image value type and all contributions', async () => {
    const manifest = await runManifestSource(manifestSource);
    // serialize(creator()) of ImageValue -> "[]"
    expect(manifest.values).toEqual([{ name: 'image', defaultJSON: '[]' }]);
    const kinds = manifest.contributions.map((c) => c.kind).sort();
    expect(kinds).toEqual(
      [
        ContributionKind.Control,
        ContributionKind.Panel,
        ContributionKind.Specific,
        ContributionKind.Specific,
        ContributionKind.ValueType
      ].sort()
    );
    const control = manifest.contributions.find(
      (c) => c.kind === ContributionKind.Control
    );
    expect(control?.export).toBe('./ui.js#ImageControl');
    expect(control?.bind?.controlName).toBe('image');
  });
});
