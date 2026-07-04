#!/usr/bin/env node
// Committed bin entry so pnpm can link the shim on a fresh install, before
// dist exists. The real CLI only exists after `pnpm run build` in core.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cli = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'Manifest',
  'cli.js'
);

if (!existsSync(cli)) {
  process.stderr.write(
    'behave-graph-manifest: dist/Manifest/cli.js is missing - build @kiberon-labs/behave-graph first\n'
  );
  process.exit(1);
}

await import(pathToFileURL(cli).href);
