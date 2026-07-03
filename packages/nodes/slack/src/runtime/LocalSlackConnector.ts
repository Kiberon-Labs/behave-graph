import type { ISlackClient } from '../abstractions/ISlackClient.js';
import type {
  ISlackEventSource,
  SlackEventHandler
} from '../abstractions/ISlackEventSource.js';
import {
  matchesTrigger,
  type SlackEvent,
  type SlackEventType,
  type SlackSendInput,
  type SlackSendResult,
  type SlackTriggerDescriptor
} from '../abstractions/types.js';

export interface LocalSlackConnectorOptions {
  /** Slack bot token (`xoxb-...`). Held here, never in the graph. */
  token: string;
  /** Default team id stamped onto outbound sends and inbound events. */
  workspace?: string;
  /** Override the API base (e.g. for a mock server). Defaults to Slack. */
  apiBaseUrl?: string;
  /** Override `fetch` (tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
  /**
   * Invoked after each dispatched event has been delivered to its handlers.
   * Wire this to `engine.executeAllAsync()` so the fibers committed by event
   * nodes actually run. Without it, handlers enqueue work that never executes.
   */
  onAfterDispatch?: () => void;
}

interface Subscription {
  descriptor: SlackTriggerDescriptor;
  handler: SlackEventHandler;
}

/**
 * A dependency-light reference connector usable in the editor or a local script.
 * It implements **both** Slack dependencies:
 *
 * - {@link ISlackClient} , posts messages via `chat.postMessage` using the bot
 *   token it holds (so the graph never carries a secret).
 * - {@link ISlackEventSource} , keeps in-memory subscriptions and delivers events
 *   you feed in via {@link dispatch} (or {@link dispatchRaw} for a Socket Mode /
 *   Events API `event` payload).
 *
 * It deliberately does **not** open a live Slack connection. That keeps the
 * package free of socket/SDK dependencies and keeps the local/backend split
 * honest: the production backend supplies its own connector that owns the live
 * Socket Mode link and (typically) far smarter routing, while satisfying the
 * same two interfaces. See the README for the backend contract.
 *
 * @example Local wiring
 * ```ts
 * const slack = new LocalSlackConnector({ token: process.env.SLACK_BOT_TOKEN! });
 * const registry = registerSlackProfile(registerCoreProfile({
 *   nodes: {}, values: {},
 *   dependencies: {
 *     ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
 *     ILogger: new DefaultLogger(),
 *     ISlackClient: slack,
 *     ISlackEventSource: slack
 *   }
 * }));
 * const engine = new Engine(graphInstance, registry);
 * slack.setPump(() => engine.executeAllAsync());
 * // ...later, when a Slack event arrives over your transport:
 * slack.dispatchRaw(rawSlackEventPayload);
 * ```
 */
export class LocalSlackConnector implements ISlackClient, ISlackEventSource {
  private readonly options: LocalSlackConnectorOptions;
  private readonly subscriptions = new Set<Subscription>();
  private readonly pumps = new Set<() => void>();

  constructor(options: LocalSlackConnectorOptions) {
    this.options = options;
    if (options.onAfterDispatch) this.pumps.add(options.onAfterDispatch);
  }

  /**
   * Replace all registered pumps with a single one. Convenience for the common
   * single-engine local case (`slack.setPump(() => engine.executeAllAsync())`).
   */
  setPump(pump: () => void): void {
    this.pumps.clear();
    this.pumps.add(pump);
  }

  /**
   * Register an additional engine pump, returning a function to remove it. A
   * server sharing one connector across many runs calls this per run (and the
   * returned remover on run teardown) so every live engine drains the fibers an
   * event enqueues. Pumping an engine with no pending work is a no-op.
   */
  addPump(pump: () => void): () => void {
    this.pumps.add(pump);
    return () => {
      this.pumps.delete(pump);
    };
  }

  // --- ISlackEventSource ----------------------------------------------------

  subscribe(
    descriptor: SlackTriggerDescriptor,
    handler: SlackEventHandler
  ): () => void {
    const subscription: Subscription = { descriptor, handler };
    this.subscriptions.add(subscription);
    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  /**
   * Deliver a normalized event to every matching subscriber, then pump the
   * engine. Call this from your transport (or a test) once you've turned a raw
   * Slack payload into a {@link SlackEvent}.
   */
  dispatch(event: SlackEvent): void {
    const stamped: SlackEvent =
      event.workspace === undefined && this.options.workspace !== undefined
        ? { ...event, workspace: this.options.workspace }
        : event;

    for (const subscription of this.subscriptions) {
      if (matchesTrigger(subscription.descriptor, stamped)) {
        subscription.handler(stamped);
      }
    }
    for (const pump of this.pumps) {
      pump();
    }
  }

  /**
   * Normalize a raw Slack `event` payload (the `event` object from a Socket Mode
   * `events_api` envelope or an Events API HTTP body) and dispatch it. Returns
   * `true` if the payload mapped to a known event type, `false` if it was
   * ignored.
   */
  dispatchRaw(payload: unknown): boolean {
    const event = LocalSlackConnector.normalizeEvent(payload);
    if (!event) return false;
    this.dispatch(event);
    return true;
  }

  /**
   * Map a raw Slack `event` object onto our normalized {@link SlackEvent}, or
   * `undefined` for event types we don't model. Static so a backend connector
   * can reuse the exact same normalization and stay behavior-compatible.
   */
  static normalizeEvent(payload: unknown): SlackEvent | undefined {
    if (typeof payload !== 'object' || payload === null) return undefined;
    const p = payload as Record<string, unknown>;
    const rawType = typeof p['type'] === 'string' ? (p['type'] as string) : '';

    const knownTypes: SlackEventType[] = [
      'message',
      'app_mention',
      'reaction_added'
    ];
    if (!knownTypes.includes(rawType as SlackEventType)) return undefined;
    const type = rawType as SlackEventType;

    const str = (key: string): string =>
      typeof p[key] === 'string' ? (p[key] as string) : '';

    // `reaction_added` carries the reacted-to message's channel + ts under
    // `item`, not at the top level.
    let ts = str('ts');
    let channel = str('channel');
    if (type === 'reaction_added') {
      const item = p['item'];
      if (typeof item === 'object' && item !== null) {
        const itemRecord = item as Record<string, unknown>;
        if (typeof itemRecord['ts'] === 'string') ts = itemRecord['ts'];
        if (typeof itemRecord['channel'] === 'string') {
          channel = itemRecord['channel'];
        }
      }
    }

    return {
      type,
      channel,
      workspace: str('team') || undefined,
      user: str('user'),
      text: str('text'),
      ts,
      threadTs: str('thread_ts') || undefined,
      reaction: type === 'reaction_added' ? str('reaction') : undefined,
      raw: payload
    };
  }

  // --- ISlackClient ---------------------------------------------------------

  async sendMessage(input: SlackSendInput): Promise<SlackSendResult> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      return { ok: false, error: 'No fetch implementation available' };
    }

    const baseUrl = this.options.apiBaseUrl ?? 'https://slack.com/api';
    const body: Record<string, unknown> = {
      channel: input.channel,
      text: input.text
    };
    if (input.blocks) body['blocks'] = input.blocks;
    if (input.threadTs) body['thread_ts'] = input.threadTs;

    try {
      const response = await fetchImpl(`${baseUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${this.options.token}`
        },
        body: JSON.stringify(body)
      });

      const result = (await response.json()) as {
        ok: boolean;
        ts?: string;
        error?: string;
      };

      if (result.ok) {
        return { ok: true, ts: result.ts };
      }
      return { ok: false, error: result.error ?? 'unknown_error' };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}
