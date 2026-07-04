import { createRequire } from 'node:module';
import * as path from 'node:path';

/**
 * On-demand TypeScript transpilation using a compiler resolved from the **user's
 * workspace**, not one bundled into the extension.
 *
 * `.ts` / `.tsx` registries and editor plugins are type-stripped on demand so
 * authors don't need a build step. Rather than embed a copy of esbuild (a large
 * native binary) or the TypeScript compiler in the published `.vsix`, we resolve
 * whichever the project already depends on from its `node_modules`:
 *
 * 1. `esbuild`: preferred (fast, handles TSX), used when present.
 * 2. `typescript`: fallback via `ts.transpileModule`.
 *
 * A workspace that ships `.ts` registries/plugins already has one of these as a
 * dev dependency, so in practice the resolution just works. If neither is
 * installed we throw an actionable error instead of silently failing.
 */

export interface TranspileOptions {
  /** `ts` for plain TypeScript, `tsx` for TypeScript + JSX (classic runtime). */
  loader: 'ts' | 'tsx';
  /** Module format of the emitted code. Defaults to `esm`. */
  format?: 'esm' | 'cjs';
  /** ECMAScript target. Defaults to `es2021`. */
  target?: string;
  /** Original file path, for source maps / diagnostics. */
  sourcefile?: string;
}

/** Transpile a TypeScript source string to browser/Node-ready JavaScript. */
type Transpiler = (
  source: string,
  options: TranspileOptions
) => Promise<{ code: string }>;

/** Cache resolved transpilers by the directory we resolved them from. */
const cache = new Map<string, Promise<Transpiler>>();

function makeEsbuildTranspiler(esbuild: typeof import('esbuild')): Transpiler {
  return async (source, options) => {
    const { code } = await esbuild.transform(source, {
      loader: options.loader,
      format: options.format ?? 'esm',
      target: options.target ?? 'es2021',
      sourcefile: options.sourcefile
    });
    return { code };
  };
}

function makeTypeScriptTranspiler(ts: typeof import('typescript')): Transpiler {
  return async (source, options) => {
    const result = ts.transpileModule(source, {
      fileName: options.sourcefile,
      compilerOptions: {
        // Classic React runtime: authors get `React.createElement` and rely on
        // the global `window.React` the webview exposes, matching esbuild's
        // default and the `plugin.tsx` contract.
        jsx: options.loader === 'tsx' ? ts.JsxEmit.React : ts.JsxEmit.None,
        module:
          options.format === 'cjs'
            ? ts.ModuleKind.CommonJS
            : ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2021,
        esModuleInterop: true,
        // Type stripping only. Never resolve or type-check the project.
        isolatedModules: true,
        verbatimModuleSyntax: false
      }
    });
    return { code: result.outputText };
  };
}

/**
 * Resolve a transpiler from the workspace containing `fromDir`. Prefers
 * `esbuild`, falls back to `typescript`. Cached per directory.
 */
function getWorkspaceTranspiler(fromDir: string): Promise<Transpiler> {
  const cached = cache.get(fromDir);
  if (cached) return cached;

  const resolved = (async (): Promise<Transpiler> => {
    // Anchor resolution at a (non-existent) file inside `fromDir` so Node walks
    // `fromDir/node_modules` and every ancestor's `node_modules`.
    const require = createRequire(
      path.join(fromDir, '__transpile_anchor__.js')
    );

    try {
      const esbuild = require(
        require.resolve('esbuild')
      ) as typeof import('esbuild');
      return makeEsbuildTranspiler(esbuild);
    } catch {
      /* esbuild not installed in the workspace; try TypeScript next */
    }

    try {
      const ts = require(
        require.resolve('typescript')
      ) as typeof import('typescript');
      return makeTypeScriptTranspiler(ts);
    } catch {
      /* neither available */
    }

    throw new Error(
      'No TypeScript transpiler found in the workspace. Install `esbuild` or ' +
        '`typescript` as a dev dependency (e.g. `npm i -D esbuild`) to use ' +
        '`.ts`/`.tsx` registries and editor plugins, or ship compiled ' +
        '`.js`/`.mjs` files instead.'
    );
  })();

  // Don't cache a failed resolution; the user may install the tool and retry.
  resolved.catch(() => cache.delete(fromDir));
  cache.set(fromDir, resolved);
  return resolved;
}

/** Convenience: resolve a workspace transpiler and transpile in one call. */
export async function transpileInWorkspace(
  source: string,
  options: TranspileOptions,
  fromDir: string
): Promise<{ code: string }> {
  const transpile = await getWorkspaceTranspiler(fromDir);
  return transpile(source, options);
}
