import { parseManifest, runManifestSource } from '@kiberon-labs/behave-graph';
import manifestSource from '../src/manifest.source.js';
import { describe, test, expect } from 'vitest';

describe('slack package manifest', () => {
  test('generates a valid manifest from the source', async () => {
    const manifest = await runManifestSource(manifestSource);
    expect(parseManifest(manifest).ok).toBe(true);
    expect(manifest.package.name).toBe(
      '@kiberon-labs/behave-graph-nodes-slack'
    );
    expect(manifest.categories).toEqual(['integration']);
    expect(manifest.runtime).toBe('./index.js');
    expect(manifest.nodes.map((n) => n.type).sort()).toEqual([
      'slack/composeMessage',
      'slack/onMention',
      'slack/onMessage',
      'slack/onReaction',
      'slack/sendMessage',
      'slack/sendStructuredMessage'
    ]);
    expect(manifest.values.map((v) => v.name)).toEqual(['slackMessage']);
  });

  test('declares the Socket Mode backend service requirement', async () => {
    const manifest = await runManifestSource(manifestSource);
    const backend = manifest.requirements?.find(
      (r) => r.kind === 'backendService'
    );
    expect(backend).toBeDefined();
    expect(backend).toMatchObject({
      entry: './backend.js',
      persistent: true,
      providesTriggers: true,
      transport: 'websocket'
    });
    // The trigger nodes are flagged as backend-dependent.
    expect((backend as { dependentNodes?: string[] }).dependentNodes).toEqual([
      'slack/onMessage',
      'slack/onMention',
      'slack/onReaction'
    ]);
  });

  test('declares the required tokens as config', async () => {
    const manifest = await runManifestSource(manifestSource);
    const config = manifest.requirements?.find((r) => r.kind === 'config') as
      | { keys: { name: string; required?: boolean; secret?: boolean }[] }
      | undefined;
    expect(config).toBeDefined();
    const byName = Object.fromEntries(
      (config?.keys ?? []).map((k) => [k.name, k])
    );
    expect(byName['SLACK_BOT_TOKEN']).toMatchObject({
      required: true,
      secret: true
    });
    expect(byName['SLACK_APP_TOKEN']).toMatchObject({
      required: true,
      secret: true
    });
  });
});
