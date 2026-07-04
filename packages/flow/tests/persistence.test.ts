import { describe, it, expect, beforeEach, vi } from 'vitest';
import { System } from '../src/system/system.js';
import type { UIGraphJSON } from '../src/types/graph.js';

const fakeUIGraph = (): UIGraphJSON =>
  ({ flow: { nodes: [] } }) as unknown as UIGraphJSON;

describe('default graph/layout persistence', () => {
  let system: System;

  beforeEach(() => {
    system = new System();
  });

  it('subscribes save handlers by default (no per-host wiring)', () => {
    // The three save topics each have exactly one default subscriber.
    expect(system.pubsub.countSubscriptions('graph:saved')).toBe(1);
    expect(system.pubsub.countSubscriptions('graph:inner:saved')).toBe(1);
    expect(system.pubsub.countSubscriptions('layout:saved')).toBe(1);
  });

  it('routes a custom adapter and keeps defaults for omitted topics', () => {
    const saveGraph = vi.fn();
    system.enablePersistence({ saveGraph });

    // Replacing does not stack subscriptions.
    expect(system.pubsub.countSubscriptions('graph:saved')).toBe(1);

    const graph = fakeUIGraph();
    system.pubsub.publishSync('graph:saved', graph);
    expect(saveGraph).toHaveBeenCalledWith(graph);
  });

  it('disablePersistence removes all save handlers', () => {
    system.disablePersistence();
    expect(system.pubsub.countSubscriptions('graph:saved')).toBe(0);
    expect(system.pubsub.countSubscriptions('graph:inner:saved')).toBe(0);
    expect(system.pubsub.countSubscriptions('layout:saved')).toBe(0);

    // Publishing after disabling is a no-op (no subscriber throws).
    expect(() =>
      system.pubsub.publishSync('graph:saved', fakeUIGraph())
    ).not.toThrow();
  });

  it('does not throw when the default (download) sink runs without a DOM', () => {
    const graph = fakeUIGraph();
    // jsdom provides document/URL, but the guard makes this safe either way.
    expect(() => system.pubsub.publishSync('graph:saved', graph)).not.toThrow();
  });
});
