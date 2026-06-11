import ts from 'typescript';
import { typeRefNameToText } from './utils.js';
import type {
  FunctionCandidate,
  AnalyzedParam,
  AnalyzedNodeFunction
} from './types.js';

export function analyzeNodeFunction(args: {
  candidate: FunctionCandidate;
  checker: ts.TypeChecker;
  outputTypeLocalNames: Set<string>;
}): AnalyzedNodeFunction | undefined {
  const { candidate, checker, outputTypeLocalNames } = args;

  let name: string;
  let parameters: readonly ts.ParameterDeclaration[];

  let implMemberName: string | undefined;

  if (candidate.kind === 'function') {
    name = candidate.node.name!.text;
    parameters = candidate.node.parameters;
  } else if (candidate.kind === 'variable') {
    name = candidate.name;
    parameters = candidate.initializer.parameters;
  } else {
    // Exported class with static exec
    name = candidate.node.name!.text;
    implMemberName = 'exec';
    parameters = candidate.exec.parameters;
  }

  const analyzedParams: AnalyzedParam[] = [];
  for (const param of parameters) {
    if (!ts.isIdentifier(param.name)) continue;
    const paramName = param.name.text;

    const isOutput = isOutputParameter({
      param,
      checker,
      outputTypeLocalNames
    });
    const valueTypeName = inferValueTypeName({ param, checker, isOutput });

    analyzedParams.push({
      name: paramName,
      valueTypeName,
      typeNodeForCast: param.type,
      isOutput
    });
  }

  const inputs = analyzedParams.filter((p) => !p.isOutput);
  const outputs = analyzedParams.filter((p) => p.isOutput);

  return {
    name,
    implMemberName,
    isDefaultExport: candidate.isDefaultExport,
    inputs,
    outputs,
    paramsInOrder: analyzedParams
  };
}

function isOutputParameter(args: {
  param: ts.ParameterDeclaration;
  checker: ts.TypeChecker;
  outputTypeLocalNames: Set<string>;
}): boolean {
  const { param, checker, outputTypeLocalNames } = args;

  // AST-level: `output: Output<T>` or aliased import
  if (param.type && ts.isTypeReferenceNode(param.type)) {
    const typeNameText = typeRefNameToText(param.type.typeName);
    if (typeNameText && outputTypeLocalNames.has(typeNameText)) return true;
  }

  // Reflection-level (type checker)
  const t = checker.getTypeAtLocation(param);
  const symbol = t.getSymbol();
  if (symbol && symbol.getName() === 'Output') return true;

  if (t.isUnion()) {
    return t.types.some((ut) => ut.getSymbol()?.getName() === 'Output');
  }

  return false;
}

function inferValueTypeName(args: {
  param: ts.ParameterDeclaration;
  checker: ts.TypeChecker;
  isOutput: boolean;
}): string {
  const { param, checker, isOutput } = args;

  if (isOutput && param.type && ts.isTypeReferenceNode(param.type)) {
    const arg0 = param.type.typeArguments?.[0];
    if (arg0) {
      const type = checker.getTypeFromTypeNode(arg0);
      return typeToValueTypeName(type, checker);
    }
  }

  if (param.type) {
    const type = checker.getTypeFromTypeNode(param.type);
    return typeToValueTypeName(type, checker);
  }

  return 'unknown';
}

function typeToValueTypeName(type: ts.Type, checker: ts.TypeChecker): string {
  if (type.flags & ts.TypeFlags.NumberLike) return 'number';
  if (type.flags & ts.TypeFlags.StringLike) return 'string';
  if (type.flags & ts.TypeFlags.BooleanLike) return 'boolean';
  if (type.flags & ts.TypeFlags.BigIntLike) return 'bigint';
  if (type.flags & ts.TypeFlags.Void) return 'void';

  const symbol = type.getSymbol();
  if (symbol) {
    const name = symbol.getName();
    if (name === 'Flow' || name === 'flow') return '__type';
    // Don't return __type for other valid type names
    if (name && !name.startsWith('__')) return name;
  }

  // Try to get alias symbol for type aliases
  const aliasSymbol = type.aliasSymbol;
  if (aliasSymbol) {
    const aliasName = aliasSymbol.getName();
    if (
      aliasName &&
      aliasName !== 'Flow' &&
      aliasName !== 'flow' &&
      !aliasName.startsWith('__')
    ) {
      return aliasName;
    }
  }

  return checker.typeToString(type);
}
