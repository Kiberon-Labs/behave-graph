import * as fs from 'fs';
import * as path from 'path';

/**
 * Candidate plugin filenames next to a graph, in resolution order. Compiled
 * JS wins over TypeScript sources (matching the registry loader), so a project
 * that builds keeps working, while a no-build project can ship `plugin.ts`.
 */
const PLUGIN_CANDIDATES = [
  'plugin.js',
  'plugin.mjs',
  'plugin.ts',
  'plugin.tsx'
] as const;

export type LoadedEditorPlugin = {
  /** Browser-ready JS to inline into the webview. */
  code: string;
  /** The source file it came from. */
  sourcePath: string;
};

/** Cache of transpiled plugin code, keyed by path, invalidated by mtime. */
const transpileCache = new Map<string, { mtimeMs: number; code: string }>();

/**
 * Find an adjacent editor `plugin.*` and return browser-ready JavaScript for it.
 *
 * A `.ts` / `.tsx` plugin is transpiled on demand with esbuild (type stripping +
 * JSX), so authors don't need a build step. The result is injected into the
 * webview as an inline classic script, so the plugin must not use ESM
 * `import` / `export` (push to `window.behaveGraphPlugins` instead — see the
 * audio example). Returns `undefined` when no plugin file is present.
 */
export async function loadEditorPlugin(
  documentDir: string
): Promise<LoadedEditorPlugin | undefined> {
  for (const name of PLUGIN_CANDIDATES) {
    const sourcePath = path.join(documentDir, name);
    if (!fs.existsSync(sourcePath)) continue;

    const isTs = sourcePath.endsWith('.ts') || sourcePath.endsWith('.tsx');
    if (!isTs) {
      return { code: fs.readFileSync(sourcePath, 'utf8'), sourcePath };
    }

    // Reuse the previous transpile if the file hasn't changed.
    const mtimeMs = fs.statSync(sourcePath).mtimeMs;
    const cached = transpileCache.get(sourcePath);
    if (cached && cached.mtimeMs === mtimeMs) {
      return { code: cached.code, sourcePath };
    }

    // Transpile TypeScript/TSX → JS in the extension host (esbuild is bundled
    // external and resolved from node_modules at runtime).
    const esbuild = await import('esbuild');
    const { code } = await esbuild.transform(fs.readFileSync(sourcePath, 'utf8'), {
      loader: sourcePath.endsWith('.tsx') ? 'tsx' : 'ts',
      target: 'es2021',
      sourcefile: sourcePath
    });
    transpileCache.set(sourcePath, { mtimeMs, code });
    console.log(`Transpiled editor plugin from ${sourcePath}`);
    return { code, sourcePath };
  }
  return undefined;
}
