import { loadBackendService } from '@kiberon-labs/behave-graph';
import { describe, test, expect, vi } from 'vitest';
import {
  createSlackBackendService,
  type SlackSocketClient
} from '../src/backend.js';
import type { SlackEvent } from '../src/abstractions/types.js';

/** A fake Socket Mode client that lets a test drive inbound events. */
class FakeSocket implements SlackSocketClient {
  handler?: (p: {
    ack?: () => Promise<void>;
    event?: unknown;
  }) => void | Promise<void>;
  started = false;
  disconnected = false;
  acks = 0;

  on(_event: 'slack_event', listener: FakeSocket['handler']): void {
    this.handler = listener;
  }
  async start(): Promise<void> {
    this.started = true;
  }
  async disconnect(): Promise<void> {
    this.disconnected = true;
  }
  async emit(event: unknown): Promise<void> {
    await this.handler?.({
      event,
      ack: async () => {
        this.acks += 1;
      }
    });
  }
}

const config = {
  SLACK_BOT_TOKEN: 'xoxb-test',
  SLACK_APP_TOKEN: 'xapp-test',
  SLACK_WORKSPACE: 'TEAM'
};

describe('slack backend service', () => {
  test('opens the socket and contributes both Slack dependencies', async () => {
    const socket = new FakeSocket();
    const entry = createSlackBackendService({ socketFactory: () => socket });

    const instance = await loadBackendService(
      { kind: 'backendService', entry: './backend.js' },
      { import: async () => entry, context: { config } }
    );

    expect(instance).toBeDefined();
    expect(socket.started).toBe(true);
    // Same connector satisfies both dependencies.
    expect(instance?.dependencies.ISlackClient).toBeDefined();
    expect(instance?.dependencies.ISlackEventSource).toBe(
      instance?.dependencies.ISlackClient
    );
  });

  test('routes inbound socket events to event subscribers + acks', async () => {
    const socket = new FakeSocket();
    const entry = createSlackBackendService({ socketFactory: () => socket });
    const startRun = vi.fn();

    const instance = await loadBackendService(
      { kind: 'backendService', entry: './backend.js' },
      { import: async () => entry, context: { config, startRun } }
    );

    const source = instance?.dependencies.ISlackEventSource;
    expect(source).toBeDefined();
    const seen: SlackEvent[] = [];
    source?.subscribe({ type: 'app_mention' }, (e) => seen.push(e));

    await socket.emit({
      type: 'app_mention',
      channel: 'C1',
      user: 'U1',
      text: 'deploy please',
      ts: '5.0'
    });

    expect(socket.acks).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      type: 'app_mention',
      channel: 'C1',
      text: 'deploy please',
      workspace: 'TEAM'
    });
    // providesTriggers: a handled event wakes a graph via startRun.
    expect(startRun).toHaveBeenCalledOnce();

    await instance?.stop();
    expect(socket.disconnected).toBe(true);
  });

  test('does not wake a run for an unrecognized event type', async () => {
    const socket = new FakeSocket();
    const entry = createSlackBackendService({ socketFactory: () => socket });
    const startRun = vi.fn();

    await loadBackendService(
      { kind: 'backendService', entry: './backend.js' },
      { import: async () => entry, context: { config, startRun } }
    );

    await socket.emit({ type: 'team_join', user: 'U1' });
    expect(startRun).not.toHaveBeenCalled();
  });

  test('fails fast when required tokens are missing', async () => {
    const entry = createSlackBackendService({
      socketFactory: () => new FakeSocket()
    });
    await expect(entry.start({ config: {} })).rejects.toThrow(
      /SLACK_BOT_TOKEN/
    );
    await expect(
      entry.start({ config: { SLACK_BOT_TOKEN: 'xoxb' } })
    ).rejects.toThrow(/SLACK_APP_TOKEN/);
  });
});
