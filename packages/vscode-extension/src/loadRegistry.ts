import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  registerCoreProfile,
  ManualLifecycleEventEmitter
} from '@kiberon-labs/behave-graph';
import type {
  IRegistry,
  IStateService,
  ILogger
} from '@kiberon-labs/behave-graph';

const REGISTRY_CANDIDATES = [
  'registry.js',
  'registry.mjs',
  'registry.ts'
] as const;

/** A throwaway in-memory state service for one-shot headless runs. */
function makeStateService(): IStateService {
  const store = new Map<string, unknown>();
  return {
    getState: (key) => store.get(key),
    setState: (key, value) => {
      store.set(key, value);
    },
    storeEvent: () => {},
    rehydrateState: async () => {},
    syncState: async () => {},
    syncAndClearState: async () => {},
    resetState: async () => {
      store.clear();
    }
  };
}

async function importModule(filePath: string): Promise<Record<string, unknown>> {
  const toUrl = (p: string) => pathToFileURL(p).href;
  try {
    return await import(toUrl(filePath));
  } catch (err) {
    if (!filePath.endsWith('.ts')) throw err;
    // Transpile the TS registry on demand and import the emitted ESM from a
    // sibling temp file so bare-specifier resolution still works.
    const esbuild = await import('esbuild');
    const { code } = await esbuild.transform(fs.readFileSync(filePath, 'utf8'), {
      loader: 'ts',
      format: 'esm',
      target: 'es2021',
      sourcefile: filePath
    });
    const tmp = filePath.replace(/\.ts$/, `.__exec.${process.pid}.${Date.now()}.mjs`);
    fs.writeFileSync(tmp, code);
    try {
      return await import(toUrl(tmp));
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* best effort */
      }
    }
  }
}

/**
 * Build the registry to run a graph headlessly: an adjacent `registry.ts`/`.js`
 * (transpiled on demand) if present, otherwise the core profile. In both cases
 * fresh run-scoped dependencies (logger, lifecycle, state) are injected.
 */
export async function loadGraphRegistry(
  graphDir: string,
  logger: ILogger
): Promise<IRegistry> {
  const deps = {
    ILogger: logger,
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
    IStateService: makeStateService()
  };

  for (const name of REGISTRY_CANDIDATES) {
    const registryPath = path.join(graphDir, name);
    if (!fs.existsSync(registryPath)) continue;
    const mod = await importModule(registryPath);
    const registry = (mod.registry ?? mod.default) as IRegistry | undefined;
    if (!registry) break;
    return { ...registry, dependencies: { ...registry.dependencies, ...deps } };
  }

  return registerCoreProfile({ values: {}, nodes: {}, dependencies: deps });
}
