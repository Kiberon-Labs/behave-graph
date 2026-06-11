import path from 'path';
import ts from 'typescript';
import { analyzeNodeFunction } from './analyzer.js';
import {
  collectExportedFunctionLikeDeclarations,
  collectImportedTypeNames,
  collectPrimaryBehaveGraphImportModule
} from './collector.js';
import {
  makeSafeIdentifier,
  stripKnownScriptExtension,
  filePathToRelativeModuleSpecifier,
  collectTopLevelTypeNames
} from './utils.js';
import type {
  GeneratedNode,
  AnalyzedNodeFunction,
  AnalyzedParam
} from './types.js';

export function emitCompiledNodesSourceFile(args: {
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  behaveGraphModuleNames: string[];
  outputFilePath?: string;
  sourceModuleSpecifier?: string;
}): { statements: ts.Statement[]; nodes: GeneratedNode[] } {
  const {
    sourceFile,
    checker,
    behaveGraphModuleNames,
    outputFilePath,
    sourceModuleSpecifier
  } = args;

  const outputTypeLocalNames = collectImportedTypeNames(
    sourceFile,
    behaveGraphModuleNames,
    'Output'
  );
  const importsModule =
    collectPrimaryBehaveGraphImportModule(sourceFile, behaveGraphModuleNames) ??
    behaveGraphModuleNames[0];

  const candidates = collectExportedFunctionLikeDeclarations(sourceFile);
  const generated: GeneratedNode[] = [];

  const inputFilePath = path.resolve(sourceFile.fileName);
  const sourceImportSpecifier =
    sourceModuleSpecifier ??
    (outputFilePath
      ? filePathToRelativeModuleSpecifier(
          path.resolve(outputFilePath),
          inputFilePath
        )
      : `./${stripKnownScriptExtension(path.basename(inputFilePath))}`);

  const sourceImportSpecifiers: ts.ImportSpecifier[] = [];
  let defaultImportName: string | undefined;

  // For the behave-graph import, we intentionally follow the fixture conventions:
  // - Always value-import Node and Socket.
  // - If the node only needs Output as a type (and no other extra types), import Output as a value and order: Node, Output, Socket.
  // - If the node needs other types (e.g. Flow), import those + Output as type-only and order: Node, Socket, type <extras>, type Output.
  const referencedTypeNames = new Set<string>(['Output']);
  const sourceTypeNames = new Set<string>();
  const classStatements: ts.Statement[] = [];
  type AnalyzedInfoWithImplName = AnalyzedNodeFunction & { implName: string };
  const analyzedInfos: AnalyzedInfoWithImplName[] = [];

  for (const candidate of candidates) {
    const info = analyzeNodeFunction({
      candidate,
      checker,
      outputTypeLocalNames
    });
    if (!info) continue;
    generated.push({
      name: info.name,
      inputs: info.inputs.map(({ name, valueTypeName }) => ({
        name,
        valueTypeName
      })),
      outputs: info.outputs.map(({ name, valueTypeName }) => ({
        name,
        valueTypeName
      }))
    });

    // Avoid name collisions: the generated class uses `info.name`.
    // Import the original function under a stable alias.
    const implName = makeSafeIdentifier(`${info.name}__impl`);
    info.implName = implName;
    analyzedInfos.push(info as AnalyzedInfoWithImplName);

    // Track any additional types used in casts so we can import them.
    for (const p of info.paramsInOrder) {
      if (!p.typeNodeForCast) continue;
      for (const name of collectTopLevelTypeNames(p.typeNodeForCast)) {
        if (name === 'Node' || name === 'Socket') continue;
        referencedTypeNames.add(name);

        // Check if this type is defined in the source file
        const isSourceType = isTypeDefinedInSourceFile(sourceFile, name);
        if (isSourceType) {
          sourceTypeNames.add(name);
        }
      }
    }

    classStatements.push(emitNodeClass(info));
  }

  // Add source file types to source import specifiers FIRST (before function imports)
  for (const typeName of [...sourceTypeNames].sort()) {
    sourceImportSpecifiers.push(
      ts.factory.createImportSpecifier(
        true,
        undefined,
        ts.factory.createIdentifier(typeName)
      )
    );
  }

  // Then add function imports
  for (const info of analyzedInfos) {
    if (info.isDefaultExport) {
      // For default exports, we'll use a default import
      defaultImportName = info.implName;
    } else {
      sourceImportSpecifiers.push(
        ts.factory.createImportSpecifier(
          false,
          ts.factory.createIdentifier(info.name),
          ts.factory.createIdentifier(info.implName)
        )
      );
    }
  }

  const extraTypes = [...referencedTypeNames].filter(
    (n) => n !== 'Output' && !sourceTypeNames.has(n)
  );
  const hasExtraTypes = extraTypes.length > 0;

  const behaveGraphImportSpecifiers: ts.ImportSpecifier[] = [];

  if (!hasExtraTypes) {
    // Matches `example.expected.ts`
    behaveGraphImportSpecifiers.push(
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('Node')
      ),
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('Socket')
      ),
      ts.factory.createImportSpecifier(
        true,
        undefined,
        ts.factory.createIdentifier('Output')
      )
    );
  } else {
    // Matches `flow.expected.ts`
    behaveGraphImportSpecifiers.push(
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('Node')
      ),
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('Socket')
      )
    );

    // Type-only extras (sorted), then type-only Output last.
    for (const t of extraTypes.sort((a, b) => a.localeCompare(b))) {
      behaveGraphImportSpecifiers.push(
        ts.factory.createImportSpecifier(
          true,
          undefined,
          ts.factory.createIdentifier(t)
        )
      );
    }
    behaveGraphImportSpecifiers.push(
      ts.factory.createImportSpecifier(
        true,
        undefined,
        ts.factory.createIdentifier('Output')
      )
    );
  }

  const importDecl = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(behaveGraphImportSpecifiers)
    ),
    ts.factory.createStringLiteral(importsModule!),
    undefined
  );

  const sourceImportDecl =
    defaultImportName || sourceImportSpecifiers.length > 0
      ? ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            defaultImportName
              ? ts.factory.createIdentifier(defaultImportName)
              : undefined,
            sourceImportSpecifiers.length > 0
              ? ts.factory.createNamedImports(sourceImportSpecifiers)
              : undefined
          ),
          ts.factory.createStringLiteral(sourceImportSpecifier),
          undefined
        )
      : undefined;

  return {
    statements: sourceImportDecl
      ? [importDecl, sourceImportDecl, ...classStatements]
      : [importDecl, ...classStatements],
    nodes: generated
  };
}

export function emitNodeClass(info: AnalyzedNodeFunction): ts.ClassDeclaration {
  const ctor = emitConstructor(info);
  const modifiers = info.isDefaultExport
    ? [
        ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
        ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword)
      ]
    : [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)];

  return ts.factory.createClassDeclaration(
    modifiers,
    ts.factory.createIdentifier(info.name),
    undefined,
    [
      ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ts.factory.createExpressionWithTypeArguments(
          ts.factory.createIdentifier('Node'),
          undefined
        )
      ])
    ],
    [ctor]
  );
}

function emitConstructor(
  info: AnalyzedNodeFunction
): ts.ConstructorDeclaration {
  const thisInputsAssign = ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        'inputs'
      ),
      ts.SyntaxKind.EqualsToken,
      ts.factory.createArrayLiteralExpression(
        info.inputs.map((p) => emitSocketNewExpression(p)),
        true
      )
    )
  );

  const thisOutputsAssign = ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        'outputs'
      ),
      ts.SyntaxKind.EqualsToken,
      ts.factory.createArrayLiteralExpression(
        info.outputs.map((p) => emitSocketNewExpression(p)),
        true
      )
    )
  );

  const execAssign = ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        'exec'
      ),
      ts.SyntaxKind.EqualsToken,
      emitExecArrowFunction(info)
    )
  );

  return ts.factory.createConstructorDeclaration(
    undefined,
    [],
    ts.factory.createBlock(
      [
        ts.factory.createExpressionStatement(
          ts.factory.createCallExpression(
            ts.factory.createSuper(),
            undefined,
            []
          )
        ),
        thisInputsAssign,
        thisOutputsAssign,
        execAssign
      ],
      true
    )
  );
}

function emitSocketNewExpression(param: AnalyzedParam): ts.NewExpression {
  const typeArgument = extractSocketTypeNode(param);
  const typeArguments = typeArgument ? [typeArgument] : undefined;

  return ts.factory.createNewExpression(
    ts.factory.createIdentifier('Socket'),
    typeArguments,
    [
      ts.factory.createObjectLiteralExpression(
        [
          ts.factory.createPropertyAssignment(
            'name',
            ts.factory.createStringLiteral(param.name)
          ),
          // ts.factory.createPropertyAssignment('valueTypeName', ts.factory.createStringLiteral(param.valueTypeName)),
          ts.factory.createPropertyAssignment('node', ts.factory.createThis())
        ],
        true
      )
    ]
  );
}

function extractSocketTypeNode(param: AnalyzedParam): ts.TypeNode | undefined {
  if (!param.typeNodeForCast) return undefined;

  // For Output<T>, extract the inner type T
  if (param.isOutput && ts.isTypeReferenceNode(param.typeNodeForCast)) {
    const typeArgs = param.typeNodeForCast.typeArguments;
    if (typeArgs && typeArgs.length > 0) {
      return typeArgs[0];
    }
  }

  // For regular types, use as-is
  return param.typeNodeForCast;
}

function emitExecArrowFunction(info: AnalyzedNodeFunction): ts.ArrowFunction {
  const preambleStatements: ts.Statement[] = [];

  for (const input of info.inputs) {
    const readCall = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        'read'
      ),
      undefined,
      [ts.factory.createStringLiteral(input.name)]
    );

    preambleStatements.push(
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(input.name),
              undefined,
              undefined,
              castExpression(readCall, input.typeNodeForCast)
            )
          ],
          ts.NodeFlags.Const
        )
      )
    );
  }

  for (const output of info.outputs) {
    const outCall = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        'getOutput'
      ),
      undefined,
      [ts.factory.createStringLiteral(output.name)]
    );

    preambleStatements.push(
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(output.name),
              undefined,
              undefined,
              castExpression(outCall, output.typeNodeForCast)
            )
          ],
          ts.NodeFlags.Const
        )
      )
    );
  }

  const implIdent = ts.factory.createIdentifier(info.implName ?? info.name);
  const callee: ts.Expression = info.implMemberName
    ? ts.factory.createPropertyAccessExpression(implIdent, info.implMemberName)
    : implIdent;
  const callArgs = info.paramsInOrder.map((p) =>
    ts.factory.createIdentifier(p.name)
  );
  const callStatement = ts.factory.createExpressionStatement(
    ts.factory.createCallExpression(callee, undefined, callArgs)
  );

  return ts.factory.createArrowFunction(
    undefined,
    undefined,
    [],
    undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    ts.factory.createBlock([...preambleStatements, callStatement], true)
  );
}

function castExpression(
  expr: ts.Expression,
  typeNode?: ts.TypeNode
): ts.Expression {
  if (!typeNode) return expr;
  return ts.factory.createAsExpression(expr, typeNode);
}

function isTypeDefinedInSourceFile(
  sourceFile: ts.SourceFile,
  typeName: string
): boolean {
  for (const stmt of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === typeName) {
      return true;
    }
    if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === typeName) {
      return true;
    }
    if (ts.isClassDeclaration(stmt) && stmt.name?.text === typeName) {
      return true;
    }
    if (ts.isEnumDeclaration(stmt) && stmt.name.text === typeName) {
      return true;
    }
  }
  return false;
}
