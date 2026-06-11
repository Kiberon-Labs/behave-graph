import ts from 'typescript';

export type GenerateNodesOptions = {
  behaveGraphModuleNames?: string[];
  extraRootFiles?: string[];
  compilerOptions?: ts.CompilerOptions;

  /**
   * When provided, the generator will compute a relative module specifier
   * from this output file to the input source file for importing the original
   * functions.
   */
  outputFilePath?: string;

  /**
   * Override the module specifier used to import the original source file.
   * If set, takes precedence over `outputFilePath`.
   */
  sourceModuleSpecifier?: string;
};

export type GeneratedNode = {
  name: string;
  inputs: Array<{ name: string; valueTypeName: string }>;
  outputs: Array<{ name: string; valueTypeName: string }>;
};

export type FunctionCandidate =
  | {
      kind: 'function';
      node: ts.FunctionDeclaration;
      isDefaultExport?: boolean;
    }
  | {
      kind: 'variable';
      name: string;
      initializer: ts.ArrowFunction | ts.FunctionExpression;
      isDefaultExport?: boolean;
    }
  | {
      kind: 'class';
      node: ts.ClassDeclaration;
      exec: ts.MethodDeclaration;
      isDefaultExport?: boolean;
    };

export type AnalyzedParam = {
  name: string;
  valueTypeName: string;
  typeNodeForCast?: ts.TypeNode;
  isOutput: boolean;
};

export type AnalyzedNodeFunction = {
  name: string;
  implName?: string;
  implMemberName?: string;
  isDefaultExport?: boolean;
  inputs: AnalyzedParam[];
  outputs: AnalyzedParam[];
  paramsInOrder: AnalyzedParam[];
};

export const DEFAULT_BEHAVE_GRAPH_MODULE_NAMES = [
  'behave-graph',
  '@kiberon-labs/behave-graph'
];
