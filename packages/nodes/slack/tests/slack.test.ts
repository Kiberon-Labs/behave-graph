import {
  DefaultLogger,
  Engine,
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  registerCoreProfile,
  validateValueRegistry,
  type GraphJSON,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { matchesTrigger } from '../src/abstractions/types.js';
import { LocalSlackConnector } from '../src/runtime/LocalSlackConnector.js';
import { registerSlackProfile } from '../src/index.js';

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('slack profile', () => {
  let registry: IRegistry = {
    nodes: {},
    values: {},
    dependencies: {}
  } as unknown as IRegistry;
  registry = registerCoreProfile(registry);
  registry = registerSlackProfile(registry);

  test('value registry is valid', () => {
    expect(validateValueRegistry(registry.values)).toHaveLength(0);
  });

  test('registers all node types + slackMessage value', () => {
    for (const type of [
      'slack/composeMessage',
      'slack/sendMessage',
      'slack/sendStructuredMessage',
      'slack/onMessage',
      'slack/onMention',
      'slack/onReaction'
    ]) {
      expect(registry.nodes[type]).toBeDefined();
    }
    expect(registry.values['slackMessage']).toBeDefined();
  });
});

describe('matchesTrigger', () => {
  const event = {
    type: 'app_mention' as const,
    channel: 'C1',
    user: 'U1',
    text: 'hi',
    ts: '1.1'
  };

  test('matches on type only', () => {
    expect(matchesTrigger({ type: 'app_mention' }, event)).toBe(true);
  });
  test('honors channel + workspace filters', () => {
    expect(matchesTrigger({ type: 'app_mention', channel: 'C1' }, event)).toBe(
      true
    );
    expect(matchesTrigger({ type: 'app_mention', channel: 'C2' }, event)).toBe(
      false
    );
    expect(
      matchesTrigger({ type: 'app_mention', workspace: 'TX' }, event)
    ).toBe(false);
  });
  test('rejects a different type', () => {
    expect(matchesTrigger({ type: 'message' }, event)).toBe(false);
  });
});

describe('LocalSlackConnector.normalizeEvent', () => {
  test('maps a message payload', () => {
    const e = LocalSlackConnector.normalizeEvent({
      type: 'message',
      channel: 'C1',
      user: 'U1',
      text: 'hello',
      ts: '1.0',
      thread_ts: '0.9',
      team: 'T2'
    });
    expect(e).toMatchObject({
      type: 'message',
      channel: 'C1',
      text: 'hello',
      threadTs: '0.9',
      workspace: 'T2'
    });
  });

  test('pulls reaction channel + ts from item', () => {
    const e = LocalSlackConnector.normalizeEvent({
      type: 'reaction_added',
      user: 'U9',
      reaction: 'thumbsup',
      item: { type: 'message', channel: 'C5', ts: '10.5' },
      ts: '11.0'
    });
    expect(e).toMatchObject({
      type: 'reaction_added',
      channel: 'C5',
      ts: '10.5',
      reaction: 'thumbsup'
    });
  });

  test('ignores unknown event types', () => {
    expect(LocalSlackConnector.normalizeEvent({ type: 'unknown' })).toBe(
      undefined
    );
  });
});

describe('connector routing', () => {
  test('delivers only to matching subscribers, stamps workspace, pumps', () => {
    const conn = new LocalSlackConnector({ token: 'x', workspace: 'TEAM' });
    let pumped = 0;
    conn.setPump(() => {
      pumped++;
    });
    const seen: unknown[] = [];
    const unsub = conn.subscribe({ type: 'app_mention', channel: 'C1' }, (e) =>
      seen.push(e)
    );
    conn.subscribe({ type: 'message' }, (e) => seen.push(e));

    conn.dispatch({
      type: 'app_mention',
      channel: 'C1',
      user: 'U1',
      text: 'yo',
      ts: '2.0'
    });

    expect(seen).toHaveLength(1);
    expect((seen[0] as { workspace?: string }).workspace).toBe('TEAM');
    expect(pumped).toBe(1);

    unsub();
    conn.dispatch({
      type: 'app_mention',
      channel: 'C1',
      user: 'U1',
      text: 'again',
      ts: '3.0'
    });
    expect(seen).toHaveLength(1);
    expect(pumped).toBe(2);
  });
});

describe('end-to-end through the Engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('inbound mention drives an outbound send with carried text', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const mockFetch = vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        json: async () => ({ ok: true, ts: '99.0' })
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const slack = new LocalSlackConnector({
      token: 'xoxb-test',
      workspace: 'TEAM',
      fetchImpl: mockFetch
    });

    let registry: IRegistry = {
      nodes: {},
      values: {},
      dependencies: {
        ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
        ILogger: new DefaultLogger(),
        ISlackClient: slack,
        ISlackEventSource: slack
      }
    } as unknown as IRegistry;
    registry = registerCoreProfile(registry);
    registry = registerSlackProfile(registry);

    const graphJson: GraphJSON = {
      nodes: [
        {
          id: 'ev',
          type: 'slack/onMention',
          parameters: { channel: { value: 'C1' } },
          flows: { flow: { nodeId: 'send', socket: 'flow' } }
        },
        {
          id: 'send',
          type: 'slack/sendMessage',
          parameters: {
            channel: { value: 'C1' },
            text: { link: { nodeId: 'ev', socket: 'text' } }
          }
        }
      ]
    };

    const graphInstance = readGraphFromJSON({ graphJson, registry });
    const engine = new Engine(graphInstance, registry);
    slack.setPump(() => void engine.executeAllAsync());

    // Event nodes init asynchronously; let their subscribe() land.
    await tick();

    slack.dispatchRaw({
      type: 'app_mention',
      channel: 'C1',
      user: 'U1',
      text: 'deploy please',
      ts: '5.0'
    });
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toMatch(/\/chat\.postMessage$/);
    expect(calls[0]?.body['channel']).toBe('C1');
    expect(calls[0]?.body['text']).toBe('deploy please');

    // A mention in a different channel must be filtered out.
    slack.dispatchRaw({
      type: 'app_mention',
      channel: 'OTHER',
      user: 'U1',
      text: 'nope',
      ts: '6.0'
    });
    await tick();
    expect(calls).toHaveLength(1);

    engine.dispose();
  });
});
