import type { ManifestSource } from './defineManifestSource.js';
import type { ManifestJSON } from './ManifestJSON.js';
import { writeManifest } from './writeManifest.js';

export type RunManifestSourceOptions = {
  /** Overrides {@link ManifestSource.runtime} when set. */
  runtime?: string;
};

/**
 * Build a {@link ManifestJSON} from an already-imported {@link ManifestSource}.
 *
 * This is the trusted, build-time step: it invokes `source.registry()` (the
 * package's own `registerProfile`, possibly async for WASM init) exactly once.
 * No node/UI imports here, so it is unit-testable and safe to export from the
 * platform-neutral barrel.
 */
export async function runManifestSource(
  source: ManifestSource,
  options: RunManifestSourceOptions = {}
): Promise<ManifestJSON> {
  const registry = await source.registry();
  return writeManifest({
    package: source.package,
    registry,
    contributions: source.contributions,
    runtime: options.runtime ?? source.runtime,
    categories: source.categories,
    requirements: source.requirements,
    metadata: source.metadata
  });
}
