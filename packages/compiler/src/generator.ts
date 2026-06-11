import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { normalizePositions, formatTypeScript } from './formatter.js';
import { emitCompiledNodesSourceFile } from './emitter.js';
import type { GenerateNodesOptions, GeneratedNode } from './types.js';
import { DEFAULT_BEHAVE_GRAPH_MODULE_NAMES } from './types.js';

export type { GenerateNodesOptions, GeneratedNode } from './types.js';

export function generateNodesFromFile(
  inputFilePath: string,
  options: GenerateNodesOptions = {}
): {
  code: string;
  nodes: GeneratedNode[];
  diagnostics: readonly ts.Diagnostic[];
} {
  const behaveGraphModuleNames =
    options.behaveGraphModuleNames ?? DEFAULT_BEHAVE_GRAPH_MODULE_NAMES;

  const resolvedInput = path.resolve(inputFilePath);
  const rootNames = [
    resolvedInput,
    ...(options.extraRootFiles ?? []).map((p) => path.resolve(p))
  ];

  const program = ts.createProgram({
    rootNames,
    options: {
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true,
      resolveJsonModule: true,
      noEmit: true,
      ...(options.compilerOptions ?? {})
    }
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(resolvedInput);
  if (!sourceFile) {
    throw new Error(`Could not load source file: ${resolvedInput}`);
  }

  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
  const { statements, nodes } = emitCompiledNodesSourceFile({
    sourceFile,
    checker,
    behaveGraphModuleNames,
    outputFilePath: options.outputFilePath,
    sourceModuleSpecifier: options.sourceModuleSpecifier
  });

  const baseOut = ts.createSourceFile(
    'generated.ts',
    '',
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS
  );
  const outSourceFile = ts.factory.updateSourceFile(baseOut, statements);

  // TS 5.9 printer expects non-negative positions in some code paths.
  normalizePositions(outSourceFile);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const code = formatTypeScript(
    printer.printFile(outSourceFile),
    'generated.ts'
  );

  return { code, nodes, diagnostics };
}

export function writeGeneratedNodesToFile(
  inputFilePath: string,
  outputFilePath: string,
  options: GenerateNodesOptions = {}
): { nodes: GeneratedNode[]; diagnostics: readonly ts.Diagnostic[] } {
  const { code, nodes, diagnostics } = generateNodesFromFile(
    inputFilePath,
    options
  );
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, code, 'utf8');
  return { nodes, diagnostics };
}
