import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MANIFEST_PACKAGE_FIELD,
  parseManifest,
  type ManifestJSON
} from '@kiberon-labs/behave-graph';

/**
 * Static discovery of package manifests from `node_modules`.
 *
 * This reads only `package.json` + the manifest JSON each package points to via
 * its `behaveGraph.manifest` field. **No package code is imported or executed** —
 * the whole point of the manifest is that a host can enumerate a package's nodes,
 * value types and requirements without running it. Importing the runtime or any
 * code contribution is a separate, trust-gated step the caller performs later.
 */

export type DiscoveredManifest = {
  packageName: string;
  /** Absolute path to the package directory. */
  packageDir: string;
  /** Absolute path to the manifest JSON. */
  manifestPath: string;
  manifest: ManifestJSON;
};

export type ManifestDiscoveryError = {
  packageName?: string;
  manifestPath?: string;
  message: string;
};

export type ManifestDiscoveryResult = {
  manifests: DiscoveredManifest[];
  errors: ManifestDiscoveryError[];
};

type PackageJson = {
  name?: string;
  [MANIFEST_PACKAGE_FIELD]?: { manifest?: string };
};

const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await fs.readFile(file, 'utf8'));

/** List package directories in a `node_modules`, descending into `@scope`s. */
async function listPackageDirs(nodeModulesDir: string): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(nodeModulesDir, { withFileTypes: true });
  } catch {
    return []; // no node_modules here
  }

  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith('.')) continue; // .bin, .pnpm, .cache
    const full = path.join(nodeModulesDir, entry.name);
    if (entry.name.startsWith('@')) {
      // Scoped: the real packages are one level deeper.
      try {
        const scoped = await fs.readdir(full, { withFileTypes: true });
        for (const s of scoped) {
          if (s.isDirectory() || s.isSymbolicLink()) dirs.push(path.join(full, s.name));
        }
      } catch {
        // ignore unreadable scope dir
      }
    } else {
      dirs.push(full);
    }
  }
  return dirs;
}

/** Read one package's manifest if it declares one; collect any error. */
async function loadPackageManifest(
  packageDir: string,
  errors: ManifestDiscoveryError[]
): Promise<DiscoveredManifest | undefined> {
  let pkg: PackageJson;
  try {
    pkg = (await readJson(path.join(packageDir, 'package.json'))) as PackageJson;
  } catch {
    return undefined; // no/invalid package.json — not our concern
  }

  const manifestRel = pkg[MANIFEST_PACKAGE_FIELD]?.manifest;
  if (!manifestRel) return undefined; // package opts out of the manifest system

  const manifestPath = path.resolve(packageDir, manifestRel);
  let raw: unknown;
  try {
    raw = await readJson(manifestPath);
  } catch {
    errors.push({
      packageName: pkg.name,
      manifestPath,
      message: `manifest file missing or not valid JSON`
    });
    return undefined;
  }

  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    errors.push({
      packageName: pkg.name,
      manifestPath,
      message: `invalid manifest: ${parsed.errors.join('; ')}`
    });
    return undefined;
  }

  return {
    packageName: pkg.name ?? parsed.manifest.package.name,
    packageDir,
    manifestPath,
    manifest: parsed.manifest
  };
}

/**
 * Discover all package manifests reachable from the given workspace roots.
 * Scans each root's `node_modules`. A package found under multiple roots is
 * de-duplicated by package name (first one wins).
 */
export async function discoverManifests(
  roots: string[]
): Promise<ManifestDiscoveryResult> {
  const errors: ManifestDiscoveryError[] = [];
  const byName = new Map<string, DiscoveredManifest>();

  for (const root of roots) {
    const packageDirs = await listPackageDirs(path.join(root, 'node_modules'));
    for (const packageDir of packageDirs) {
      const found = await loadPackageManifest(packageDir, errors);
      if (found && !byName.has(found.packageName)) {
        byName.set(found.packageName, found);
      }
    }
  }

  return { manifests: Array.from(byName.values()), errors };
}
