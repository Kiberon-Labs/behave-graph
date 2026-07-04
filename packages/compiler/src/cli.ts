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

interface ParsedArgs {
  input: string;
  outFile: string | undefined;
  dtsFile: string | undefined;
}

/** Parse the flag arguments that follow the input file. */
function parseFlags(args: string[]): {
  outFile: string | undefined;
  dtsFile: string | undefined;
} {
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

  return { outFile, dtsFile };
}

const HELP_FLAGS = ['-h', '--help'];

/** Print usage and exit when no args or a help flag was passed. */
function exitOnHelpRequest(args: string[]): void {
  const wantsHelp = args.some((a) => HELP_FLAGS.includes(a));
  if (args.length === 0 || wantsHelp) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }
}

/** True when the value names a compilable input file. */
function isSupportedInput(input: string | undefined): input is string {
  return !!input && (input.endsWith('.ts') || input.endsWith('.js'));
}

/** Parse CLI argv into structured options. Prints usage and exits on
 *  missing help/input rather than returning. */
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  exitOnHelpRequest(args);

  const input = args[0];
  if (!isSupportedInput(input)) {
    console.error('Error: No input file specified.');
    printUsage();
    process.exit(1);
  }

  const { outFile, dtsFile } = parseFlags(args);
  return { input, outFile, dtsFile };
}

/** Generate nodes and write them to outFile, logging the result. */
function runWriteToFile(
  input: string,
  outFile: string,
  extraRootFiles: string[]
): void {
  const { nodes, diagnostics } = writeGeneratedNodesToFile(input, outFile, {
    extraRootFiles,
    outputFilePath: outFile
  });
  if (diagnostics.length) {
    console.error(`TypeScript diagnostics: ${diagnostics.length}`);
  }
  console.log(`Generated ${nodes.length} node(s) -> ${path.resolve(outFile)}`);
}

/** Generate nodes and stream the emitted code to stdout. */
function runToStdout(input: string, extraRootFiles: string[]): void {
  const { code, diagnostics } = generateNodesFromFile(input, {
    extraRootFiles
  });
  if (diagnostics.length) {
    console.error(`TypeScript diagnostics: ${diagnostics.length}`);
  }
  process.stdout.write(code);
}

function main(argv: string[]): void {
  const { input, outFile, dtsFile } = parseArgs(argv);
  const extraRootFiles = dtsFile ? [dtsFile] : [];

  if (outFile) {
    runWriteToFile(input, outFile, extraRootFiles);
    return;
  }

  runToStdout(input, extraRootFiles);
}

main(process.argv);
