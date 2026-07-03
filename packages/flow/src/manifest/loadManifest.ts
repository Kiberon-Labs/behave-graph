import type {
  ContributionSpec,
  ManifestJSON,
  PackageRequirement
} from '@kiberon-labs/behave-graph';
import type { System } from '@/system/system';
import type { ValueTypeMetadata } from '@/types/NodeMetadata';
import { passthroughValueType } from './passthroughValueType';
import { applyContribution } from './contributionRegistry';

/**
 * Resolves a contribution's declarative `export` (e.g. `"./ui.js#ImageControl"`)
 * to its actual value. The host owns this because a bundler must know the
 * concrete module — so loading code contributions is always host-mediated and
 * gated behind {@link LoadManifestOptions.trust}.
 */
export type ContributionResolver = (
  contribution: ContributionSpec,
  manifest: ManifestJSON
) => unknown | Promise<unknown>;

export type LoadManifestOptions = {
  /**
   * Gate for executing code contributions. Default `false`: only nodes and
   * pass-through value types load (no package code runs). Set true together
   * with {@link LoadManifestOptions.resolve} once the package is trusted.
   */
  trust?: boolean;
  /** Required to load contributions; without it only the static parts load. */
  resolve?: ContributionResolver;
  /**
   * Called for each declared host requirement (persistent backend, config,
   * ...). Lets the host surface a badge or run a backend. No code executes here.
   */
  onRequirement?: (
    requirement: PackageRequirement,
    manifest: ManifestJSON
  ) => void;
};

/**
 * Load a package manifest into the editor.
 *
 * Always (no code execution): registers the node specs and pass-through value
 * types, so the palette is fully populated from JSON alone. Only under explicit
 * `trust` + a `resolve`r does it import and register the package's code
 * contributions. Declared host requirements are surfaced via `onRequirement`.
 */
export async function loadManifest(
  system: System,
  manifest: ManifestJSON,
  options: LoadManifestOptions = {}
): Promise<void> {
  // 1. Static: nodes + pass-through value types. No package code runs.
  const values: Record<string, ValueTypeMetadata> = {};
  for (const value of manifest.values) {
    values[value.name] = passthroughValueType(value);
  }
  system.registry.getState().updateRegistry({ specs: manifest.nodes, values });

  // 2. Surface host requirements (no code execution).
  if (options.onRequirement && manifest.requirements) {
    for (const requirement of manifest.requirements) {
      options.onRequirement(requirement, manifest);
    }
  }

  // 3. Code contributions — only when explicitly trusted and a resolver exists.
  if (!options.trust || !options.resolve) return;
  for (const contribution of manifest.contributions) {
    try {
      const value = await options.resolve(contribution, manifest);
      if (value === null || value === undefined) continue;
      applyContribution(system, contribution, value);
    } catch (err) {
      console.error(
        `[manifest] failed to load contribution '${contribution.id}'`,
        err
      );
    }
  }
}
