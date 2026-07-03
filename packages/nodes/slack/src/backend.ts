import {
  defineBackendService,
  type BackendServiceContext,
  type BackendServiceEntry,
  type BackendServiceInstance
} from '@kiberon-labs/behave-graph';
import { LocalSlackConnector } from './runtime/LocalSlackConnector.js';

/**
 * The Slack backend service: the persistent, side-effecting host component the
 * package's `backendService` manifest requirement points at.
 *
 * A server that installs the slack package reads the manifest, sees the
 * `backendService` requirement, and (under its trust gate) imports this module
 * and `loadBackendService`s it. On {@link BackendServiceEntry.start} we:
 *
 *  1. read the bot + app tokens from `context.config`,
 *  2. build a {@link LocalSlackConnector} (it already does `chat.postMessage` and
 *     in-memory event routing),
 *  3. **open a Socket Mode connection** (the side effect) and pipe every inbound
 *     Slack event into the connector, and
 *  4. return `{ ISlackClient, ISlackEventSource }` for the host to inject into
 *     every run's registry, plus a `stop()` that closes the socket.
 *
 * The trigger nodes (`slack/onMention`, ...) then resolve a live event source at
 * execution time — without the graph, the package author, or the host needing to
 * know how the others are wired.
 */

/**
 * Minimal contract for a Socket Mode client. Matches `@slack/socket-mode`'s
 * `SocketModeClient` (an EventEmitter that emits `'slack_event'` for each inbound
 * event and has `start`/`disconnect`), but is declared here so the base package
 * stays free of a hard `@slack/socket-mode` dependency and so tests can inject a
 * fake.
 */
export interface SlackSocketClient {
  on(
    event: 'slack_event',
    listener: (payload: {
      ack?: () => Promise<void>;
      event?: unknown;
    }) => void | Promise<void>
  ): void;
  start(): Promise<unknown>;
  disconnect(): Promise<unknown>;
}

/** Builds a Socket Mode client from an app-level token (`xapp-...`). */
export type SlackSocketFactory = (
  appToken: string
) => SlackSocketClient | Promise<SlackSocketClient>;

/**
 * Default factory: dynamically import `@slack/socket-mode` so it is an *optional*
 * dependency only the backend pulls in. The specifier is held in a variable so
 * the bundler/TS don't try to resolve it at build time — a server that runs the
 * backend installs `@slack/socket-mode`; the editor/local package never needs it.
 */
const defaultSocketFactory: SlackSocketFactory = async (appToken: string) => {
  const moduleName = '@slack/socket-mode';
  const mod = (await import(moduleName)) as {
    SocketModeClient: new (opts: { appToken: string }) => SlackSocketClient;
  };
  return new mod.SocketModeClient({ appToken });
};

export interface SlackBackendOptions {
  /** Override how the Socket Mode client is created (tests, alt transports). */
  socketFactory?: SlackSocketFactory;
}

/**
 * Build the Slack {@link BackendServiceEntry}. Exposed as a factory so a host (or
 * a test) can inject a custom {@link SlackBackendOptions.socketFactory}; the
 * default export uses the real `@slack/socket-mode` client.
 */
export function createSlackBackendService(
  options: SlackBackendOptions = {}
): BackendServiceEntry {
  const socketFactory = options.socketFactory ?? defaultSocketFactory;

  return defineBackendService({
    async start(
      context: BackendServiceContext
    ): Promise<BackendServiceInstance> {
      const botToken = context.config['SLACK_BOT_TOKEN'];
      const appToken = context.config['SLACK_APP_TOKEN'];
      if (!botToken) {
        throw new Error(
          '[slack backend] SLACK_BOT_TOKEN is required to send messages'
        );
      }
      if (!appToken) {
        throw new Error(
          '[slack backend] SLACK_APP_TOKEN is required for Socket Mode'
        );
      }

      const connector = new LocalSlackConnector({
        token: botToken,
        workspace: context.config['SLACK_WORKSPACE']
      });

      const socket = await socketFactory(appToken);

      socket.on('slack_event', async (payload) => {
        // Acknowledge first so Slack doesn't retry, then route the event.
        try {
          await payload.ack?.();
        } catch {
          // An ack failure shouldn't drop the event.
        }
        if (payload.event !== undefined && payload.event !== null) {
          const handled = connector.dispatchRaw(payload.event);
          // A host that starts a graph per trigger gets woken here.
          if (handled && context.startRun) {
            void context.startRun({ trigger: payload.event });
          }
        }
      });

      await socket.start(); // <-- the side effect: opens the WebSocket.
      context.logger?.log('info', '[slack backend] Socket Mode connected');

      return {
        dependencies: {
          ISlackClient: connector,
          ISlackEventSource: connector
        },
        async stop() {
          await socket.disconnect();
          context.logger?.log('info', '[slack backend] Socket Mode stopped');
        }
      };
    }
  });
}

/** The entry the manifest's `backendService.entry` resolves to. */
export default createSlackBackendService();
