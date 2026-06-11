import path from 'path';
import ts from 'typescript';

export function makeSafeIdentifier(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_$]/g, '_');
  if (/^[A-Za-z_$]/.test(cleaned)) return cleaned;
  return `_${cleaned}`;
}

export function stripKnownScriptExtension(fileName: string): string {
  return fileName.replace(/\.(mts|cts|ts|tsx|mjs|cjs|js|jsx)$/i, '');
}

export function filePathToRelativeModuleSpecifier(
  fromOutputFilePath: string,
  toInputFilePath: string
): string {
  const fromDir = path.dirname(fromOutputFilePath);
  let rel = path.relative(fromDir, toInputFilePath);
  rel = rel.replace(/\\/g, '/');
  rel = stripKnownScriptExtension(rel);
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
  return rel;
}

export function typeRefNameToText(typeName: ts.EntityName): string | undefined {
  if (ts.isIdentifier(typeName)) return typeName.text;
  if (ts.isQualifiedName(typeName)) return typeName.right.text;
  return undefined;
}

export function collectTopLevelTypeNames(typeNode: ts.TypeNode): Set<string> {
  const names = new Set<string>();

  const visit = (n: ts.Node): void => {
    if (ts.isTypeReferenceNode(n)) {
      const text = typeRefNameToText(n.typeName);
      if (text) names.add(text);
    } else if (ts.isExpressionWithTypeArguments(n)) {
      // Shouldn't happen in type positions here, but keep robust.
    }
    ts.forEachChild(n, visit);
  };

  visit(typeNode);
  return names;
}

export function hasExportModifier(node: ts.Node): boolean {
  return !!(
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}
