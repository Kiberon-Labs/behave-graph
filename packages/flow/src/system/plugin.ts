import type { System } from '.';
import type { GraphSession } from './graphSession';

/**
 * Plugin initialization function type
 * @template TOptions - Type of options object passed to the plugin
 */
export interface Plugin<TOptions = void> {
  (system: System, options: TOptions): void | Promise<void>;
}

/**
 * Cleanup returned by a {@link SessionExtension}. Run when the session it was
 * applied to is disposed (its tab closed).
 */
export type SessionExtensionCleanup = () => void;

/**
 * Extends a single {@link GraphSession}. Registered at the editor level via
 * `system.registerSessionExtension(...)`, it runs against every graph , those
 * already open at registration time and any created afterwards , so an editor
 * plugin can attach per-graph state (extra stores, controllers, pubsub
 * subscriptions) to each new graph instance.
 *
 * Return a cleanup to tear that per-graph state down when the session is
 * disposed.
 *
 * @example
 * system.registerSessionExtension((session) => {
 *   const controller = new MyController(session);
 *   session.decorate('myController', controller);
 *   return () => controller.dispose();
 * });
 */
export interface SessionExtension {
  (session: GraphSession): void | SessionExtensionCleanup;
}
export type PluginOpts = {
  name: string;
};

export type LoadablePlugin<TOptions = void> = {
  loader: Plugin<TOptions>;
  opts: PluginOpts;
};

export const plugin = <TOptions = void>(
  registerfunc: Plugin<TOptions>,
  opts: PluginOpts
): LoadablePlugin<TOptions> => {
  return {
    loader: registerfunc,
    opts: opts
  };
};
