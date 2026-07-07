import type { IRegistry } from '../types/registry.js';
import type { ContributionSpec, PackageRequirement } from './ManifestJSON.js';

/**
 * The author-maintained, side-effect-light descriptor a node package exports
 * (e.g. from `src/manifest.source.ts`) for the manifest generator to consume.
 *
 * `contributions` is plain data  it must NOT import React/UI code  so the
 * generator can read it without pulling the package's UI bundle. The generator
 * calls {@link ManifestSource.registry} (the package's trusted `registerProfile`)
 * once, at build time, to produce node + value specs.
 */
export interface ManifestSource {
  package: { name: string; version: string };
  /** Builds the package's executable registry. May be async (e.g. WASM init). */
  registry: () => IRegistry | Promise<IRegistry>;
  contributions?: ContributionSpec[];
  /** Module specifier a runner imports to obtain the executable registry. */
  runtime?: string;
  /** Open-ended classification of the package (see PackageCategory). */
  categories?: string[];
  /** Host capabilities the package needs or ships (backends, secrets, ...). */
  requirements?: PackageRequirement[];
  /** Arbitrary forward-compatible extension data. */
  metadata?: Record<string, unknown>;
}

/** Identity helper giving authoring-time type-checking of a manifest source. */
export const defineManifestSource = (source: ManifestSource): ManifestSource =>
  source;
