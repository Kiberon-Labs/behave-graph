import type { ManifestJSON } from '@kiberon-labs/behave-graph';
import { plugin } from '@/system/plugin';
import type { System } from '@/system/system';
import { loadManifest, type LoadManifestOptions } from './loadManifest';

export interface ManifestPluginOptions extends LoadManifestOptions {
  /** Manifests to load, in order (later ones override earlier node types). */
  manifests: ManifestJSON[];
}

export async function manifestPluginLoader(
  system: System,
  options: ManifestPluginOptions
): Promise<void> {
  const { manifests, ...loadOptions } = options;
  for (const manifest of manifests) {
    await loadManifest(system, manifest, loadOptions);
  }
}

/**
 * Register one or more package manifests as a single plugin. The static parts
 * (nodes + value types) always load; code contributions load only under
 * `trust` + `resolve` (see {@link LoadManifestOptions}).
 */
export const manifestPlugin = plugin<ManifestPluginOptions>(
  manifestPluginLoader,
  { name: 'manifest' }
);
