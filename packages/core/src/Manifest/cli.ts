#!/usr/bin/env node
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { ManifestSource } from './defineManifestSource.js';
import { runManifestSource } from './generate.js';
import { MANIFEST_FILE_NAME } from './ManifestJSON.js';

const USAGE = `behave-graph-manifest <source> [--out <file|dir>] [--runtime <specifier>]

  <source>            Path to the built manifest-source module (default export
                      from defineManifestSource), e.g. dist/manifest.source.js
  --out, -o <path>    Write the manifest JSON here (default: stdout). A directory
                      target writes ${MANIFEST_FILE_NAME} into it.
  --runtime <spec>    Override the source's runtime module specifier
`;

/** Resolve a --out value to a concrete file path, honouring directory targets. */
function resolveOutPath(out: string): string {
  const abs = isAbsolute(out) ? out : resolve(process.cwd(), out);
  try {
    if (statSync(abs).isDirectory()) return join(abs, MANIFEST_FILE_NAME);
  } catch {
    // Path does not exist yet  treat it as a file path as given.
  }
  return abs;
}

/** Resolve the default (or \`manifestSource\`-named) export of a source module. */
function resolveSource(mod: Record<string, unknown>): ManifestSource {
  const candidate = mod.default ?? mod.manifestSource;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(
      'manifest source module must default-export a defineManifestSource(...) result'
    );
  }
  return candidate as ManifestSource;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      runtime: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  const sourcePath = positionals[0];
  if (values.help || !sourcePath) {
    process.stdout.write(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const absSource = isAbsolute(sourcePath)
    ? sourcePath
    : resolve(process.cwd(), sourcePath);

  const mod = (await import(pathToFileURL(absSource).href)) as Record<
    string,
    unknown
  >;
  const source = resolveSource(mod);

  const manifest = await runManifestSource(source, { runtime: values.runtime });
  const json = `${JSON.stringify(manifest, null, 2)}\n`;

  if (values.out) {
    const absOut = resolveOutPath(values.out);
    mkdirSync(dirname(absOut), { recursive: true });
    writeFileSync(absOut, json);
    process.stdout.write(
      `Wrote ${manifest.nodes.length} nodes, ${manifest.values.length} value types to ${absOut}\n`
    );
  } else {
    process.stdout.write(json);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `behave-graph-manifest: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
