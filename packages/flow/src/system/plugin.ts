import type { System } from '.';

/**
 * Plugin initialization function type
 * @template TOptions - Type of options object passed to the plugin
 */
export interface Plugin<TOptions = void> {
  (system: System, options: TOptions): void | Promise<void>;
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
