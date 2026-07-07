import * as vscode from 'vscode';

/** The boundary node types that make a graph "subgraph-style" (runnable with
 *  typed inputs → outputs). */
const INPUT_NODE = 'graph/input';
const OUTPUT_NODE = 'graph/output';

/** A single declared graph input, read from a `graph/input` boundary node. */
export type GraphInputDef = {
  name: string;
  valueTypeName: string;
  defaultValue?: unknown;
};

/** Extract the engine graph (`flow`) from a parsed `.kbgraph`, or the value
 *  itself if it is already a bare GraphJSON. */
export function extractFlow(parsed: unknown): any {
  return parsed && typeof parsed === 'object' && 'flow' in (parsed as object)
    ? (parsed as { flow: unknown }).flow
    : parsed;
}

/** True when the graph declares the subgraph-style input/output contract,
 *  i.e. it has at least one `graph/input` or `graph/output` boundary node. */
export function graphHasIOContract(flow: any): boolean {
  const nodes = flow?.nodes;
  return (
    Array.isArray(nodes) &&
    nodes.some((n) => n?.type === INPUT_NODE || n?.type === OUTPUT_NODE)
  );
}

/** Cheap gate check: a substring scan of the raw file text, avoiding a full
 *  JSON.parse of every graph during the workspace scan. The boundary node types
 *  appear verbatim as JSON string values, so this is reliable for the menu gate
 *  (the actual run does a full parse). */
function textHasIOContract(text: string): boolean {
  return text.includes(`"${INPUT_NODE}"`) || text.includes(`"${OUTPUT_NODE}"`);
}

/** Turn one raw `graph/input` parameter into a `GraphInputDef`, or `undefined`
 *  when it has no usable name. */
function toInputDef(param: any): GraphInputDef | undefined {
  const name = param?.name;
  if (typeof name !== 'string') return undefined;
  return {
    name,
    valueTypeName: param?.valueTypeName ?? param?.valueType ?? 'string',
    defaultValue: param?.defaultValue
  };
}

/** The parameter list declared on a single `graph/input` node, or `[]`. */
function inputNodeParams(node: any): any[] {
  if (node?.type !== INPUT_NODE) return [];
  const params = node?.configuration?.parameters;
  return Array.isArray(params) ? params : [];
}

/** Collect the declared inputs across all `graph/input` nodes (deduped by name). */
export function extractGraphInputs(flow: any): GraphInputDef[] {
  const out: GraphInputDef[] = [];
  const seen = new Set<string>();
  for (const node of flow?.nodes ?? []) {
    for (const param of inputNodeParams(node)) {
      const def = toInputDef(param);
      if (!def || seen.has(def.name)) continue;
      seen.add(def.name);
      out.push(def);
    }
  }
  return out;
}

/**
 * Tracks which `.kbgraph` files in the workspace are subgraph-style (and so can
 * be run via the Execute Graph command) and publishes them to a context key.
 * The Execute Graph menu item uses `resourcePath in behaveGraph.executableGraphs`
 * for its `enablement`, so non-executable graphs appear greyed out.
 */
export class ExecutableGraphTracker {
  private readonly executable = new Set<string>();

  constructor(context: vscode.ExtensionContext) {
    // Publish immediately so the `in` operator has a (empty) collection to test
    // against before the scan finishes  otherwise the menu can't evaluate.
    this.publish();
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.kbgraph');
    watcher.onDidCreate((uri) => this.update(uri));
    watcher.onDidChange((uri) => this.update(uri));
    watcher.onDidDelete((uri) => this.remove(uri));
    context.subscriptions.push(watcher);
    void this.scanWorkspace();
  }

  /** Re-scan every `.kbgraph` in the workspace. */
  async scanWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles(
      '**/*.kbgraph',
      '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}'
    );
    this.executable.clear();
    // Publish incrementally so executable graphs light up as they're found,
    // rather than only after the whole scan completes.
    await Promise.all(
      files.map(async (uri) => {
        await this.evaluate(uri);
        this.publish();
      })
    );
    this.publish();
  }

  /** Re-evaluate a single graph now (e.g. the one being opened, or just saved)
   *  and publish so the Execute Graph menu un-greys without waiting for the
   *  full workspace scan. */
  async refresh(uri: vscode.Uri): Promise<void> {
    await this.evaluate(uri);
    this.publish();
  }

  private async evaluate(uri: vscode.Uri): Promise<void> {
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      // Cheap substring gate instead of a full JSON.parse per file.
      if (textHasIOContract(new TextDecoder().decode(data)))
        this.executable.add(uri.fsPath);
      else this.executable.delete(uri.fsPath);
    } catch {
      this.executable.delete(uri.fsPath);
    }
  }

  private async update(uri: vscode.Uri): Promise<void> {
    await this.evaluate(uri);
    this.publish();
  }

  private remove(uri: vscode.Uri): void {
    this.executable.delete(uri.fsPath);
    this.publish();
  }

  private publish(): void {
    // The `in` operator checks membership against an object's keys.
    const map: Record<string, true> = {};
    for (const fsPath of this.executable) map[fsPath] = true;
    void vscode.commands.executeCommand(
      'setContext',
      'behaveGraph.executableGraphs',
      map
    );
  }
}
