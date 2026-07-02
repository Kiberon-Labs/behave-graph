import { registerCoreProfile } from '@/Profiles/Core/registerCoreProfile.js';
import { writeNodeSpecsToJSON } from '@/Graphs/IO/writeNodeSpecsToJSON.js';
import { writeManifest } from '@/Manifest/writeManifest.js';
import { runManifestSource } from '@/Manifest/generate.js';
import { defineManifestSource } from '@/Manifest/defineManifestSource.js';
import { parseManifest } from '@/Manifest/parseManifest.js';
import {
  ContributionKind,
  MANIFEST_VERSION,
  PackageCategory,
  type ContributionSpec,
  type PackageRequirement
} from '@/Manifest/ManifestJSON.js';
import { describe, test, expect } from 'vitest';

const registry = registerCoreProfile({
  values: {},
  nodes: {},
  dependencies: {}
});

const contributions: ContributionSpec[] = [
  {
    id: 'float-control',
    kind: ContributionKind.Control,
    export: './ui.js#FloatControl',
    bind: { controlName: 'float' }
  }
];

describe('writeManifest', () => {
  const manifest = writeManifest({
    package: { name: '@test/core', version: '1.2.3' },
    registry,
    contributions,
    runtime: './index.js'
  });

  test('carries package identity and version', () => {
    expect(manifest.manifestVersion).toBe(MANIFEST_VERSION);
    expect(manifest.package).toEqual({ name: '@test/core', version: '1.2.3' });
    expect(manifest.runtime).toBe('./index.js');
  });

  test('node specs match writeNodeSpecsToJSON exactly', () => {
    const specs = writeNodeSpecsToJSON(registry);
    expect(manifest.nodes).toHaveLength(specs.length);
    expect(manifest.nodes).toEqual(specs.map((s) => ({ ...s })));
  });

  test('value specs are function-free with json defaults', () => {
    const boolSpec = manifest.values.find((v) => v.name === 'boolean');
    expect(boolSpec).toBeDefined();
    expect(boolSpec).toEqual({ name: 'boolean', defaultJSON: false });
    // No function members leak into the manifest.
    manifest.values.forEach((v) => {
      Object.values(v).forEach((field) =>
        expect(typeof field).not.toBe('function')
      );
    });
  });

  test('round-trips through JSON and validates', () => {
    const roundTripped = JSON.parse(JSON.stringify(manifest));
    const result = parseManifest(roundTripped);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest).toEqual(manifest);
  });
});

describe('runManifestSource', () => {
  const source = defineManifestSource({
    package: { name: '@test/core', version: '2.0.0' },
    // Async builder, mirroring packages that need WASM init before the registry.
    registry: async () =>
      registerCoreProfile({ values: {}, nodes: {}, dependencies: {} }),
    runtime: './index.js',
    contributions
  });

  test('awaits the registry builder and matches writeManifest', async () => {
    const manifest = await runManifestSource(source);
    expect(parseManifest(manifest).ok).toBe(true);
    expect(manifest.package).toEqual({ name: '@test/core', version: '2.0.0' });
    expect(manifest.contributions).toEqual(contributions);
    expect(manifest.runtime).toBe('./index.js');
  });

  test('runtime override takes precedence over the source', async () => {
    const manifest = await runManifestSource(source, {
      runtime: './worker.js'
    });
    expect(manifest.runtime).toBe('./worker.js');
  });
});

describe('package categorization & host requirements', () => {
  // The Slack case: integration package whose trigger nodes need a standing
  // WebSocket backend that can wake up and start a graph, plus a bot token.
  const requirements: PackageRequirement[] = [
    {
      kind: 'backendService',
      reason: 'Slack trigger nodes need a persistent WebSocket connection',
      entry: './server/index.js',
      persistent: true,
      providesTriggers: true,
      dependentNodes: ['slack/onMessage'],
      transport: 'websocket'
    },
    {
      kind: 'config',
      keys: [{ name: 'SLACK_BOT_TOKEN', required: true, secret: true }]
    }
  ];

  const manifest = writeManifest({
    package: { name: '@test/slack', version: '0.1.0' },
    registry,
    categories: [PackageCategory.Integration],
    requirements,
    metadata: { homepage: 'https://example.com' }
  });

  test('carries categories, requirements, and metadata through generation', () => {
    expect(manifest.categories).toEqual(['integration']);
    expect(manifest.requirements).toEqual(requirements);
    expect(manifest.metadata).toEqual({ homepage: 'https://example.com' });
  });

  test('validates and survives a JSON round-trip', () => {
    const result = parseManifest(JSON.parse(JSON.stringify(manifest)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.requirements).toEqual(requirements);
  });

  test('tolerates an unknown requirement kind (forward-compat)', () => {
    const result = parseManifest({
      ...manifest,
      requirements: [{ kind: 'someFutureThing', foo: 42 }]
    });
    expect(result.ok).toBe(true);
  });

  test('rejects a requirement missing its kind discriminant', () => {
    const result = parseManifest({
      ...manifest,
      requirements: [{ entry: './x.js' }]
    });
    expect(result.ok).toBe(false);
  });

  test('rejects non-string categories', () => {
    const result = parseManifest({ ...manifest, categories: [1, 2] });
    expect(result.ok).toBe(false);
  });
});

describe('parseManifest', () => {
  const valid = writeManifest({
    package: { name: '@test/core', version: '1.0.0' },
    registry,
    contributions
  });

  test('rejects non-objects', () => {
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest(42).ok).toBe(false);
  });

  test('rejects a wrong manifestVersion', () => {
    const result = parseManifest({ ...valid, manifestVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.includes('manifestVersion'))).toBe(
        true
      );
  });

  test('rejects an unknown contribution kind', () => {
    const result = parseManifest({
      ...valid,
      contributions: [{ id: 'x', kind: 'bogus', export: './a.js#B' }]
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.includes('kind'))).toBe(true);
  });

  test('rejects malformed package metadata', () => {
    const result = parseManifest({ ...valid, package: { name: 1 } });
    expect(result.ok).toBe(false);
  });
});
