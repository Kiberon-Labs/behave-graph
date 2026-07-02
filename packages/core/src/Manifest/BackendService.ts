import type { ILogger } from '../Profiles/Core/Abstractions/ILogger.js';
import type { Dependencies } from '../types/registry.js';
import type { BackendServiceRequirement } from './ManifestJSON.js';

/**
 * The runtime contract behind a manifest's
 * {@link BackendServiceRequirement}. A manifest only *declares* that a package
 * needs a persistent host process (and points at an `entry` module); this is the
 * shape that `entry` module must expose and the protocol a host uses to boot it.
 *
 * ## Why this exists
 *
 * Some node packages can't work from node definitions alone — they need a
 * long-lived side effect set up *outside* any single graph run. The motivating
 * case is Slack: the trigger nodes (`slack/onMention`, ...) react to events that
 * only arrive if something is holding a Socket Mode WebSocket open and routing
 * inbound events. That "something" is a backend service: it is created once, kept
 * alive across runs, and contributes the engine {@link Dependencies} the trigger
 * nodes resolve at execution time.
 *
 * A standalone server that lets users *install node packages* reads each
 * package's manifest, and for every `backendService` requirement (under its trust
 * gate) imports the `entry` module and calls {@link loadBackendService}. The
 * service returns the dependencies to merge into execution registries and a
 * `stop()` for teardown. The package author never has to know how the host wires
 * runs; the host never has to understand the package's internals.
 */

/**
 * A request to start (or wake) a graph run, handed to {@link
 * BackendServiceContext.startRun} by a service that received an out-of-band
 * trigger (e.g. an inbound Slack mention should kick off a workflow).
 */
export interface StartRunRequest {
  /** Which graph to run. Host-defined opaque id (path, db id, ...). */
  graphId?: string;
  /** What caused the start — typically the normalized inbound event. */
  trigger?: unknown;
  /** Extra per-run dependencies to merge for this run only. */
  dependencies?: Partial<Dependencies>;
}

/** A handle to a run the service started, so it can later stop it. */
export interface RunHandle {
  runId: string;
  stop: () => void | Promise<void>;
}

/**
 * What the host provides to a backend service when it boots it. Everything is
 * optional except `config`, so a minimal host can still start a service that
 * only contributes dependencies.
 */
export interface BackendServiceContext {
  /**
   * Resolved configuration values, keyed by the `name`s the package declared in
   * its `config` requirement (e.g. `SLACK_BOT_TOKEN`). A host typically fills
   * this from environment variables or a secret store. Values may be undefined
   * if the host couldn't resolve them; the service decides whether to fail.
   */
  config: Record<string, string | undefined>;
  /** Logger the service should use instead of `console`. */
  logger?: ILogger;
  /**
   * Start/wake a graph run in response to a trigger the service received. The
   * host owns the run lifecycle; a service that originates triggers
   * (`providesTriggers`) calls this. Absent on hosts that don't support starting
   * runs out-of-band (the service can still contribute dependencies to runs the
   * host starts itself).
   */
  startRun?: (request: StartRunRequest) => RunHandle | Promise<RunHandle>;
  /** Forward-compatible bag for host-specific extras. */
  metadata?: Record<string, unknown>;
}

/**
 * The live service produced by {@link BackendServiceEntry.start}. The host keeps
 * this alive for as long as the package is in use and calls {@link stop} on
 * shutdown.
 */
export interface BackendServiceInstance {
  /**
   * Engine dependencies this service contributes — e.g. Slack supplies
   * `{ ISlackClient, ISlackEventSource }` backed by the live connection. The host
   * merges these into the `dependencies` of every execution registry built for a
   * run that uses this package.
   */
  dependencies: Partial<Dependencies>;
  /** Tear down the side effects (close sockets, timers, ...). */
  stop: () => void | Promise<void>;
}

/**
 * The contract a `backendService.entry` module must satisfy. Author it with
 * {@link defineBackendService} and default-export it (or export it as
 * `backendService`); {@link loadBackendService} accepts either.
 */
export interface BackendServiceEntry {
  /** Boot the service. Performs the side effect (opens sockets, etc.). */
  start: (
    context: BackendServiceContext
  ) => BackendServiceInstance | Promise<BackendServiceInstance>;
}

/** Authoring helper giving build-time type-checking of a backend entry. */
export const defineBackendService = (
  entry: BackendServiceEntry
): BackendServiceEntry => entry;

/** Extract a {@link BackendServiceEntry} from a freshly-imported entry module. */
export function resolveBackendServiceEntry(
  module: unknown
): BackendServiceEntry | undefined {
  const candidates: unknown[] = [
    module,
    (module as { default?: unknown } | null)?.default,
    (module as { backendService?: unknown } | null)?.backendService
  ];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof (candidate as BackendServiceEntry).start === 'function'
    ) {
      return candidate as BackendServiceEntry;
    }
  }
  return undefined;
}

export interface LoadBackendServiceOptions {
  /**
   * Host-mediated import of the entry module. The host owns this so the bundler
   * knows the concrete module and so importing the (code-bearing) entry is
   * always behind the host's trust gate — exactly like contribution resolving.
   * Usually `(entry) => import(entry)`.
   */
  import: (entry: string) => Promise<unknown> | unknown;
  /** Context passed straight to {@link BackendServiceEntry.start}. */
  context: BackendServiceContext;
}

/**
 * Boot the backend service declared by a {@link BackendServiceRequirement}: the
 * host imports the `entry` module (its trust gate) and starts it. Returns the
 * live instance, or `undefined` if the requirement declares no `entry` or the
 * module doesn't expose a valid {@link BackendServiceEntry}.
 *
 * This is the single, standard way a server "calls a package's side effects into
 * the system". Keep the returned instance alive and `stop()` it on shutdown.
 */
export async function loadBackendService(
  requirement: BackendServiceRequirement,
  options: LoadBackendServiceOptions
): Promise<BackendServiceInstance | undefined> {
  if (!requirement.entry) return undefined;
  const module = await options.import(requirement.entry);
  const entry = resolveBackendServiceEntry(module);
  if (!entry) return undefined;
  return entry.start(options.context);
}
