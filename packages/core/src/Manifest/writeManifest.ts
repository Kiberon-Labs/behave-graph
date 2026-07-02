import { writeNodeSpecsToJSON } from '../Graphs/IO/writeNodeSpecsToJSON.js';
import type { IRegistry } from '../types/registry.js';
import {
  MANIFEST_VERSION,
  type ContributionSpec,
  type ManifestJSON,
  type NodeManifestEntry,
  type PackageRequirement
} from './ManifestJSON.js';
import { writeValueTypesToJSON } from './writeValueTypesToJSON.js';

export type WriteManifestParams = {
  package: { name: string; version: string };
  /**
   * The package's own fully-built registry (the result of its
   * `registerProfile`). Built and passed by the package author at build time;
   * this is the single trusted execution of the package's code.
   */
  registry: IRegistry;
  contributions?: ContributionSpec[];
  /** Module specifier a runner imports to obtain the executable registry. */
  runtime?: string;
  /** Open-ended classification of the package (see PackageCategory). */
  categories?: string[];
  /** Host capabilities the package needs or ships (backends, secrets, ...). */
  requirements?: PackageRequirement[];
  /** Arbitrary forward-compatible extension data. */
  metadata?: Record<string, unknown>;
};

/**
 * Build a static {@link ManifestJSON} from a package's registry. Reuses
 * {@link writeNodeSpecsToJSON} so the node specs are byte-identical to what the
 * editor already consumes at run time.
 */
export function writeManifest(params: WriteManifestParams): ManifestJSON {
  const { registry, contributions = [], runtime } = params;

  const nodes: NodeManifestEntry[] = writeNodeSpecsToJSON(registry).map(
    (spec) => ({ ...spec })
  );

  const manifest: ManifestJSON = {
    manifestVersion: MANIFEST_VERSION,
    package: { name: params.package.name, version: params.package.version },
    values: writeValueTypesToJSON(registry.values),
    nodes,
    contributions
  };
  if (runtime !== undefined) manifest.runtime = runtime;
  if (params.categories !== undefined) manifest.categories = params.categories;
  if (params.requirements !== undefined)
    manifest.requirements = params.requirements;
  if (params.metadata !== undefined) manifest.metadata = params.metadata;
  return manifest;
}
