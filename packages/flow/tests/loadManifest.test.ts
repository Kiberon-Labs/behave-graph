import { describe, it, expect, vi } from 'vitest';
import type { ManifestJSON, PackageRequirement } from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import { loadManifest } from '../src/manifest/loadManifest.js';

const Vec2Control = () => null;
const conversionRule = { from: 'vec2', to: 'object', nodeType: 'convert/vec2ToObject' };

const manifest: ManifestJSON = {
  manifestVersion: 1,
  package: { name: '@test/pkg', version: '1.0.0' },
  values: [{ name: 'vec2', defaultJSON: { x: 0, y: 0 } }],
  nodes: [
    {
      type: 'test/node',
      category: 'Logic',
      label: 'Test Node',
      inputs: [],
      outputs: [],
      configuration: []
    }
  ],
  contributions: [
    {
      id: 'vec2-ctrl',
      kind: 'control',
      export: './ui.js#Vec2Control',
      bind: { controlName: 'vec2' }
    },
    { id: 'vec2-conv', kind: 'conversion', export: './ui.js#rule' }
  ],
  requirements: [
    { kind: 'backendService', entry: './server.js', persistent: true }
  ]
};

const resolve = (c: { id: string }) => {
  if (c.id === 'vec2-ctrl') return Vec2Control;
  if (c.id === 'vec2-conv') return conversionRule;
  return undefined;
};

describe('loadManifest', () => {
  it('loads nodes + pass-through value types without trust (no code exec)', async () => {
    const system = new System();
    await loadManifest(system, manifest);

    const reg = system.registry.getState();
    expect(reg.specs.some((s) => s.type === 'test/node')).toBe(true);

    const vec2 = reg.values['vec2'];
    expect(vec2).toBeDefined();
    // Pass-through creator returns a *clone* of the declared default.
    const created = vec2.creator();
    expect(created).toEqual({ x: 0, y: 0 });
    expect(created).not.toBe(manifest.values[0].defaultJSON);
    // Identity (de)serialize keeps existing UI call sites working.
    expect(vec2.serialize?.(created)).toEqual({ x: 0, y: 0 });

    // No contributions applied without trust.
    expect(system.controlStore.getState().controls['vec2']).toBeUndefined();
  });

  it('surfaces host requirements via onRequirement', async () => {
    const system = new System();
    const seen: PackageRequirement[] = [];
    await loadManifest(system, manifest, {
      onRequirement: (req) => seen.push(req)
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe('backendService');
  });

  it('applies code contributions only under trust + resolve', async () => {
    const system = new System();
    await loadManifest(system, manifest, { trust: true, resolve });

    expect(system.controlStore.getState().controls['vec2']).toBe(Vec2Control);
    expect(
      system.conversionStore
        .getState()
        .findConversion('vec2', 'object')
    ).toEqual(conversionRule);
  });

  it('skips contributions when trusted but no resolver is given', async () => {
    const system = new System();
    await loadManifest(system, manifest, { trust: true });
    expect(system.controlStore.getState().controls['vec2']).toBeUndefined();
  });

  it('does not let one failing contribution abort the rest', async () => {
    const system = new System();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await loadManifest(system, manifest, {
      trust: true,
      resolve: (c) => {
        if (c.id === 'vec2-ctrl') throw new Error('boom');
        return resolve(c);
      }
    });
    // The conversion still registered despite the control throwing.
    expect(
      system.conversionStore.getState().findConversion('vec2', 'object')
    ).toEqual(conversionRule);
    spy.mockRestore();
  });
});
