import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Editor settings file ("rc") support.
 *
 * Resolution follows the familiar rc / npmrc cascade: starting from a directory
 * we walk UP the filesystem tree collecting config files, plus a global config in
 * the user's home directory. Closer files win, so a project-local file overrides
 * the global one. The merged result is the serialized editor settings the webview
 * applies via `system.applySettings(...)`.
 */

/** Accepted file names, in priority order at each directory. */
export const SETTINGS_FILENAMES = ['.kbgraphrc.json', '.kbgraphrc'];

export type EditorSettingsFile = {
  settings?: Record<string, unknown>;
  conversions?: Array<{ from: string; to: string;[k: string]: unknown }>;
};

const readJsonIfExists = async (
  file: string
): Promise<EditorSettingsFile | undefined> => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined; // missing or malformed , skip this level
  }
};

/** Merge `over` on top of `base`: settings shallow-merge, conversions by from→to. */
export const mergeEditorSettings = (
  base: EditorSettingsFile,
  over: EditorSettingsFile
): EditorSettingsFile => {
  const settings = { ...(base.settings ?? {}), ...(over.settings ?? {}) };
  const byPair = new Map<string, { from: string; to: string }>();
  for (const c of base.conversions ?? []) byPair.set(`${c.from}->${c.to}`, c);
  for (const c of over.conversions ?? []) byPair.set(`${c.from}->${c.to}`, c);
  return { settings, conversions: Array.from(byPair.values()) };
};

/** The directory chain from `startDir` up to the filesystem root, inclusive. */
const dirChainToRoot = (startDir: string): string[] => {
  const chain: string[] = [];
  let dir = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    chain.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return chain; // [startDir, ..., root]
};

/**
 * Resolve the merged editor settings for a directory: the global home config
 * (lowest priority), then root → … → startDir (highest priority).
 */
export const resolveEditorSettings = async (
  startDir: string
): Promise<EditorSettingsFile> => {
  // Lowest priority first so later merges override earlier ones.
  const ordered = [os.homedir(), ...dirChainToRoot(startDir).reverse()];

  const seen = new Set<string>();
  let merged: EditorSettingsFile = {};
  for (const dir of ordered) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    for (const name of SETTINGS_FILENAMES) {
      const cfg = await readJsonIfExists(path.join(dir, name));
      if (cfg) merged = mergeEditorSettings(merged, cfg);
    }
  }
  return merged;
};

/** Path of the global (home) settings file. */
export const globalSettingsPath = (): string =>
  path.join(os.homedir(), SETTINGS_FILENAMES[0]!);

/** Path of the local settings file for a directory. */
export const localSettingsPath = (dir: string): string =>
  path.join(dir, SETTINGS_FILENAMES[0]!);

/** Write the editor settings to a directory's local rc file. */
export const writeEditorSettings = async (
  dir: string,
  settings: EditorSettingsFile
): Promise<void> => {
  await fs.writeFile(
    localSettingsPath(dir),
    JSON.stringify(settings, null, 2),
    'utf8'
  );
};
