import ts from 'typescript';

export function normalizePositions(node: ts.Node): void {
  // Mutate positions in-place; safe for synthetic output.
  (node as any).pos = 0;
  (node as any).end = 0;
  ts.forEachChild(node, normalizePositions);
}

export function formatTypeScript(code: string, fileName: string): string {
  const formatSettings: ts.FormatCodeSettings = {
    indentSize: 4,
    tabSize: 4,
    convertTabsToSpaces: true,
    newLineCharacter: '\n',
    insertSpaceAfterCommaDelimiter: true,
    insertSpaceAfterSemicolonInForStatements: true,
    insertSpaceBeforeAndAfterBinaryOperators: true,
    insertSpaceAfterKeywordsInControlFlowStatements: true,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
    placeOpenBraceOnNewLineForFunctions: false,
    placeOpenBraceOnNewLineForControlBlocks: false,
    semicolons: ts.SemicolonPreference.Insert
  };

  const servicesHost: ts.LanguageServiceHost = {
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext
    }),
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => '0',
    getScriptSnapshot: (name) => {
      if (name !== fileName) return undefined;
      return ts.ScriptSnapshot.fromString(code);
    },
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: (name) => name === fileName,
    readFile: (name) => (name === fileName ? code : undefined),
    readDirectory: () => []
  };

  const languageService = ts.createLanguageService(
    servicesHost,
    ts.createDocumentRegistry()
  );
  const edits = languageService.getFormattingEditsForDocument(
    fileName,
    formatSettings
  );
  if (!edits.length) return code;
  return applyTextChanges(code, edits);
}

function applyTextChanges(
  text: string,
  changes: readonly ts.TextChange[]
): string {
  // Apply from the end backwards so spans don't shift.
  const ordered = [...changes].sort((a, b) => b.span.start - a.span.start);
  let out = text;
  for (const c of ordered) {
    out =
      out.slice(0, c.span.start) +
      c.newText +
      out.slice(c.span.start + c.span.length);
  }
  return out;
}
