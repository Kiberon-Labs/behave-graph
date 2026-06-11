#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';

import {
  generateNodesFromFile,
  writeGeneratedNodesToFile
} from './generator.js';

function printUsage(): void {
  // Intentionally minimal.
  console.log(
    'Usage: behave-graph-compile <input.ts> [--out <output.ts>] [--dts <ambient.d.ts>]'
  );
}

function main(argv: string[]): void {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const input = args[0];

  if (!input || !(input.endsWith('.ts') || input.endsWith('.js'))) {
    console.error('Error: No input file specified.');
    printUsage();
    process.exit(1);
  }

  let outFile: string | undefined;
  let dtsFile: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') {
      outFile = args[i + 1];
      i++;
      continue;
    }
    if (a === '--dts') {
      dtsFile = args[i + 1];
      i++;
      continue;
    }
  }

  const extraRootFiles = dtsFile ? [dtsFile] : [];

  if (outFile) {
    const { nodes, diagnostics } = writeGeneratedNodesToFile(input, outFile, {
      extraRootFiles,
      outputFilePath: outFile
    });
    if (diagnostics.length) {
      console.error(`TypeScript diagnostics: ${diagnostics.length}`);
    }
    console.log(
      `Generated ${nodes.length} node(s) -> ${path.resolve(outFile)}`
    );
    return;
  }

  const { code, diagnostics } = generateNodesFromFile(input, {
    extraRootFiles
  });
  if (diagnostics.length) {
    console.error(`TypeScript diagnostics: ${diagnostics.length}`);
  }
  process.stdout.write(code);
}

main(process.argv);
