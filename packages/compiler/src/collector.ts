import ts from 'typescript';
import { hasExportModifier } from './utils.js';
import type { FunctionCandidate } from './types.js';

export function collectExportedFunctionLikeDeclarations(
  sourceFile: ts.SourceFile
): FunctionCandidate[] {
  const out: FunctionCandidate[] = [];
  for (const stmt of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.name &&
      hasExportModifier(stmt)
    ) {
      out.push({ kind: 'function', node: stmt });
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      const exec = findStaticExecMethod(stmt);
      if (exec) out.push({ kind: 'class', node: stmt, exec });
      continue;
    }

    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      // Handle export default
      const expr = stmt.expression;
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        // Use file basename without extension as the name
        const fullPath = sourceFile.fileName;
        const pathParts = fullPath.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1] || '';
        // Remove all extensions (e.g., "file.src.ts" -> "file")
        const baseName = fileName.split('.')[0] || 'default';
        out.push({
          kind: 'variable',
          name: baseName,
          initializer: expr,
          isDefaultExport: true
        });
      } else if (ts.isClassExpression(expr)) {
        const exec = expr.members.find(
          (m) =>
            ts.isMethodDeclaration(m) &&
            m.modifiers?.some(
              (mod) => mod.kind === ts.SyntaxKind.StaticKeyword
            ) &&
            m.name &&
            ((ts.isIdentifier(m.name) && m.name.text === 'exec') ||
              (ts.isStringLiteral(m.name) && m.name.text === 'exec'))
        ) as ts.MethodDeclaration | undefined;

        if (exec) {
          const fullPath = sourceFile.fileName;
          const pathParts = fullPath.split(/[/\\]/);
          const fileName = pathParts[pathParts.length - 1] || '';
          // Remove all extensions (e.g., "file.src.ts" -> "file")
          const baseName = fileName.split('.')[0] || 'default';
          // Create a synthetic class declaration for the export
          const syntheticClass = ts.factory.createClassDeclaration(
            undefined,
            baseName,
            undefined,
            undefined,
            expr.members
          );
          out.push({
            kind: 'class',
            node: syntheticClass,
            exec,
            isDefaultExport: true
          });
        }
      }
      continue;
    }

    if (!ts.isVariableStatement(stmt) || !hasExportModifier(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = decl.initializer;
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        out.push({ kind: 'variable', name: decl.name.text, initializer: init });
      }
    }
  }
  return out;
}

function findStaticExecMethod(
  cls: ts.ClassDeclaration
): ts.MethodDeclaration | undefined {
  for (const m of cls.members) {
    if (!ts.isMethodDeclaration(m)) continue;
    if (!m.name) continue;
    if (!m.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword))
      continue;
    if (ts.isIdentifier(m.name) && m.name.text === 'exec') return m;
    if (ts.isStringLiteral(m.name) && m.name.text === 'exec') return m;
  }
  return undefined;
}

export function collectImportedTypeNames(
  sourceFile: ts.SourceFile,
  moduleNames: string[],
  importedName: string
): Set<string> {
  const names = new Set<string>([importedName]);
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!moduleNames.includes(stmt.moduleSpecifier.text)) continue;
    const named = stmt.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const spec of named.elements) {
      const imported = (spec.propertyName ?? spec.name).text;
      const local = spec.name.text;
      if (imported === importedName) names.add(local);
    }
  }
  return names;
}

export function collectPrimaryBehaveGraphImportModule(
  sourceFile: ts.SourceFile,
  moduleNames: string[]
): string | undefined {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (moduleNames.includes(stmt.moduleSpecifier.text))
      return stmt.moduleSpecifier.text;
  }
  return undefined;
}
