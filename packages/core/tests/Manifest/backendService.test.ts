import {
  defineBackendService,
  loadBackendService,
  resolveBackendServiceEntry,
  type BackendServiceContext,
  type BackendServiceInstance
} from '@/Manifest/BackendService.js';
import type { BackendServiceRequirement } from '@/Manifest/ManifestJSON.js';
import { describe, test, expect, vi } from 'vitest';

const makeContext = (
  overrides: Partial<BackendServiceContext> = {}
): BackendServiceContext => ({
  config: { SLACK_BOT_TOKEN: 'xoxb', SLACK_APP_TOKEN: 'xapp' },
  ...overrides
});

describe('resolveBackendServiceEntry', () => {
  const entry = defineBackendService({
    start: () => ({ dependencies: {}, stop: () => {} })
  });

  test('accepts the module itself, default, or backendService export', () => {
    expect(resolveBackendServiceEntry(entry)).toBe(entry);
    expect(resolveBackendServiceEntry({ default: entry })).toBe(entry);
    expect(resolveBackendServiceEntry({ backendService: entry })).toBe(entry);
  });

  test('rejects modules without a start function', () => {
    expect(resolveBackendServiceEntry({})).toBeUndefined();
    expect(resolveBackendServiceEntry(null)).toBeUndefined();
    expect(resolveBackendServiceEntry({ start: 42 })).toBeUndefined();
  });
});

describe('loadBackendService', () => {
  test('imports the entry, starts it, and returns the instance', async () => {
    const stop = vi.fn();
    const instance: BackendServiceInstance = {
      dependencies: { ILogger: { log: () => {} } },
      stop
    };
    const start = vi.fn(() => instance);
    const entry = defineBackendService({ start });

    const requirement: BackendServiceRequirement = {
      kind: 'backendService',
      entry: './backend.js',
      persistent: true,
      providesTriggers: true
    };

    const importer = vi.fn(async (spec: string) => {
      expect(spec).toBe('./backend.js');
      return { default: entry };
    });
    const context = makeContext();

    const result = await loadBackendService(requirement, {
      import: importer,
      context
    });

    expect(importer).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(context);
    expect(result).toBe(instance);
  });

  test('returns undefined when the requirement declares no entry', async () => {
    const result = await loadBackendService(
      { kind: 'backendService' },
      { import: vi.fn(), context: makeContext() }
    );
    expect(result).toBeUndefined();
  });

  test('returns undefined when the module is not a valid entry', async () => {
    const result = await loadBackendService(
      { kind: 'backendService', entry: './bad.js' },
      { import: async () => ({ nope: true }), context: makeContext() }
    );
    expect(result).toBeUndefined();
  });

  test('forwards startRun + config so a service can wake graphs', async () => {
    const startRun = vi.fn(() => ({ runId: 'r1', stop: () => {} }));
    let seen: BackendServiceContext | undefined;
    const entry = defineBackendService({
      start: (ctx) => {
        seen = ctx;
        // A trigger-originating service uses startRun to kick off a run.
        void ctx.startRun?.({ trigger: { type: 'app_mention' } });
        return { dependencies: {}, stop: () => {} };
      }
    });

    await loadBackendService(
      { kind: 'backendService', entry: './b.js' },
      { import: async () => entry, context: makeContext({ startRun }) }
    );

    expect(seen?.config['SLACK_BOT_TOKEN']).toBe('xoxb');
    expect(startRun).toHaveBeenCalledWith({
      trigger: { type: 'app_mention' }
    });
  });
});
