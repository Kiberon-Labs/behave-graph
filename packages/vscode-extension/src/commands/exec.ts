import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import {
  runSubgraph,
  validateRegistry,
  type ILogger,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import {
  extractFlow,
  extractGraphInputs,
  graphHasIOContract,
  type GraphInputDef
} from '../executableGraphs.js';
import { loadGraphRegistry } from '../loadRegistry.js';

/** Collects log lines so they can be written into the run output file. */
class CollectingLogger implements ILogger {
  public readonly messages: { severity: string; text: string }[] = [];
  log(severity: string, text: string): void {
    this.messages.push({ severity, text });
  }
}

/** Make JSON.stringify tolerate BigInt (integer value type) and typed arrays. */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
      ? Number(value)
      : value.toString();
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value as unknown as ArrayLike<number>);
  }
  return value;
}

/** Coerce a raw value (string from a box, or already-parsed from JSON) into the
 *  typed value the registry expects (e.g. BigInt for `integer`). */
function coerce(
  registry: IRegistry,
  valueTypeName: string,
  value: unknown
): unknown {
  const valueType = registry.values[valueTypeName];
  if (!valueType) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  try {
    return valueType.deserialize(value as never);
  } catch {
    if (typeof value === 'string') {
      try {
        return valueType.deserialize(JSON.parse(value) as never);
      } catch {
        return value;
      }
    }
    return value;
  }
}

/** A short, human-readable rendering of a typed value for the form. */
function displayValue(
  registry: IRegistry,
  valueTypeName: string,
  value: unknown
): string {
  let serialized: unknown = value;
  try {
    serialized =
      registry.values[valueTypeName]?.serialize(value as never) ?? value;
  } catch {
    /* fall back to the raw value */
  }
  return serialized !== null && typeof serialized === 'object'
    ? JSON.stringify(serialized)
    : String(serialized);
}

/** Edit a single input value (boolean via pick, others via box). */
async function editSingle(
  def: GraphInputDef,
  current: unknown,
  registry: IRegistry
): Promise<unknown | undefined> {
  if (def.valueTypeName === 'boolean') {
    const pick = await vscode.window.showQuickPick(['true', 'false'], {
      title: `Input: ${def.name}`,
      placeHolder: `current: ${String(current)}`
    });
    return pick === undefined ? undefined : pick === 'true';
  }
  const raw = await vscode.window.showInputBox({
    title: `Input: ${def.name}`,
    prompt: `Value for "${def.name}" (${def.valueTypeName})`,
    value: displayValue(registry, def.valueTypeName, current),
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (def.valueTypeName === 'float')
        return Number.isNaN(Number(v)) ? 'Enter a number' : undefined;
      if (def.valueTypeName === 'integer')
        return /^-?\d+$/.test(v.trim()) ? undefined : 'Enter an integer';
      return undefined;
    }
  });
  return raw === undefined
    ? undefined
    : coerce(registry, def.valueTypeName, raw.trim());
}

type RunFormItem = vscode.QuickPickItem & {
  action?: 'run' | 'json' | 'output' | 'browse';
  def?: GraphInputDef;
};

/** Seed each input with its declared default, or the value type's zero value. */
function seedInputValues(
  defs: GraphInputDef[],
  registry: IRegistry
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const def of defs) {
    values[def.name] =
      def.defaultValue !== undefined
        ? coerce(registry, def.valueTypeName, def.defaultValue)
        : registry.values[def.valueTypeName]?.creator?.();
  }
  return values;
}

/** Build the QuickPick items for the run form: a Run action, one row per input,
 *  the output-path controls, and (when there are inputs) a JSON bulk-edit. */
function buildRunFormItems(
  defs: GraphInputDef[],
  registry: IRegistry,
  values: Record<string, unknown>,
  outputPath: string
): RunFormItem[] {
  const items: RunFormItem[] = [
    {
      label: '$(play) Run',
      description: 'execute and save to the output path below',
      action: 'run'
    }
  ];
  if (defs.length) {
    items.push({ label: 'Inputs', kind: vscode.QuickPickItemKind.Separator });
    for (const def of defs) {
      items.push({
        label: `$(symbol-parameter) ${def.name}`,
        description: def.valueTypeName,
        detail: `= ${displayValue(registry, def.valueTypeName, values[def.name])}`,
        def
      });
    }
  }
  items.push({ label: 'Output', kind: vscode.QuickPickItemKind.Separator });
  items.push({
    label: '$(save) Output file',
    detail: outputPath,
    action: 'output'
  });
  items.push({
    label: '$(folder) Browse…',
    description: 'pick a location with a dialog',
    action: 'browse'
  });
  if (defs.length) {
    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: '$(json) Enter all inputs as JSON…', action: 'json' });
  }
  return items;
}

/** Prompt for a new output path via an input box; returns the trimmed path or
 *  the existing one if cancelled/empty. */
async function promptOutputPath(current: string): Promise<string> {
  const raw = await vscode.window.showInputBox({
    title: 'Output file',
    prompt: 'Path to write the run output to',
    value: current,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : 'Enter a path')
  });
  return raw ? raw.trim() : current;
}

/** Prompt for an output path via a native save dialog; returns the picked path
 *  or the existing one if cancelled. */
async function browseOutputPath(current: string): Promise<string> {
  const picked = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(current),
    title: 'Save graph run output',
    saveLabel: 'Use This Path',
    filters: { JSON: ['json'], 'All Files': ['*'] }
  });
  return picked ? picked.fsPath : current;
}

/** Bulk-edit every input as one JSON object; mutates `values` in place. */
async function editInputsAsJson(
  defs: GraphInputDef[],
  registry: IRegistry,
  values: Record<string, unknown>
): Promise<void> {
  const serialized: Record<string, unknown> = {};
  for (const def of defs) {
    try {
      serialized[def.name] =
        registry.values[def.valueTypeName]?.serialize(
          values[def.name] as never
        ) ?? values[def.name];
    } catch {
      serialized[def.name] = values[def.name];
    }
  }
  const raw = await vscode.window.showInputBox({
    title: 'All inputs as JSON',
    prompt: 'Edit every input value as one JSON object',
    value: JSON.stringify(serialized),
    ignoreFocusOut: true,
    validateInput: (v) => {
      try {
        JSON.parse(v);
        return undefined;
      } catch {
        return 'Invalid JSON';
      }
    }
  });
  if (raw === undefined) return;
  const obj = JSON.parse(raw) as Record<string, unknown>;
  for (const def of defs) {
    if (def.name in obj)
      values[def.name] = coerce(registry, def.valueTypeName, obj[def.name]);
  }
}

/**
 * Collect all input values through a single QuickPick "form": every input is
 * shown at once with its current (default-filled) value, so the user can hit
 * **Run** to accept the defaults, edit individual inputs, or enter them all as
 * one JSON object. Returns the values, or `undefined` if cancelled.
 */
async function promptRunForm(
  defs: GraphInputDef[],
  registry: IRegistry,
  defaultOutputPath: string
): Promise<
  { inputs: Record<string, unknown>; outputPath: string } | undefined
> {
  const values = seedInputValues(defs, registry);
  let outputPath = defaultOutputPath;

  for (;;) {
    const items = buildRunFormItems(defs, registry, values, outputPath);
    const pick = await vscode.window.showQuickPick(items, {
      title: 'Run graph',
      placeHolder: 'Run to execute, or pick a field to change it'
    });
    if (!pick) return undefined; // cancelled the whole run

    if (pick.action === 'run') return { inputs: values, outputPath };
    else if (pick.action === 'output')
      outputPath = await promptOutputPath(outputPath);
    else if (pick.action === 'browse')
      outputPath = await browseOutputPath(outputPath);
    else if (pick.action === 'json')
      await editInputsAsJson(defs, registry, values);
    else if (pick.def) {
      // Edit one input, then return to the form.
      const edited = await editSingle(
        pick.def,
        values[pick.def.name],
        registry
      );
      if (edited !== undefined) values[pick.def.name] = edited;
    }
  }
}

/**
 * A preferred output directory declared in the nearest `.kbworkspace`
 * (walking up from the graph), via an `outputPath` field. Relative paths
 * resolve against the `.kbworkspace`'s own directory. Returns `undefined` if
 * none is configured.
 */
function resolvePreferredOutputDir(graphDir: string): string | undefined {
  let dir = path.resolve(graphDir);
  for (;;) {
    const wsPath = path.join(dir, '.kbworkspace');
    try {
      if (fs.existsSync(wsPath)) {
        const ws = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
        const out = ws?.outputPath ?? ws?.runOutput ?? ws?.output;
        if (typeof out === 'string' && out.trim()) {
          return path.isAbsolute(out) ? out : path.resolve(dir, out.trim());
        }
        return undefined; // found a workspace, but no output path declared
      }
    } catch {
      /* malformed .kbworkspace , keep walking up */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Execute a subgraph-style `.kbgraph`: prompt for its inputs, run it, and write
 * the outputs to a `<DATE>-<RUNID>.json` next to the graph.
 */
export async function executeGraphFile(uri: vscode.Uri): Promise<void> {
  const text = new TextDecoder().decode(
    await vscode.workspace.fs.readFile(uri)
  );
  let flow: any;
  try {
    flow = extractFlow(JSON.parse(text));
  } catch (err) {
    vscode.window.showErrorMessage(`Could not parse graph: ${String(err)}`);
    return;
  }

  if (!graphHasIOContract(flow)) {
    vscode.window.showWarningMessage(
      'Execute Graph requires a subgraph-style graph with graph/input or ' +
        'graph/output boundary nodes.'
    );
    return;
  }

  const logger = new CollectingLogger();
  let registry;
  try {
    registry = await loadGraphRegistry(path.dirname(uri.fsPath), logger);
  } catch (err) {
    // Most commonly a registry.ts that could not be transpiled/imported, or no
    // workspace transpiler (esbuild/typescript) available to strip its types.
    vscode.window.showErrorMessage(
      `Failed to load graph registry: ${err instanceof Error ? err.message : String(err)}`
    );
    return;
  }

  const registryErrors = validateRegistry(registry);
  if (registryErrors.length > 0) {
    vscode.window.showErrorMessage(
      `Registry is invalid: ${registryErrors.join('; ')}`
    );
    return;
  }

  // Default output path: a `.kbworkspace`-declared directory if present, else
  // the graph's folder, named `<DATE>-<RUNID>.json`. Shown in the run form so
  // the user only changes it if they want to.
  const runId = randomUUID();
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const graphDir = path.dirname(uri.fsPath);
  const defaultOutputPath = path.join(
    resolvePreferredOutputDir(graphDir) ?? graphDir,
    `${date}-${runId}.json`
  );

  const inputDefs = extractGraphInputs(flow);
  const form = await promptRunForm(inputDefs, registry, defaultOutputPath);
  if (form === undefined) return; // cancelled

  let outputs: Record<string, unknown>;
  try {
    outputs = await runSubgraph({
      graphJson: flow,
      registry,
      inputs: form.inputs
    });
  } catch (err) {
    vscode.window.showErrorMessage(`Graph execution failed: ${String(err)}`);
    return;
  }

  const result = {
    runId,
    graph: vscode.workspace.asRelativePath(uri),
    executedAt: new Date().toISOString(),
    inputs: form.inputs,
    outputs,
    logs: logger.messages
  };

  const outUri = vscode.Uri.file(form.outputPath);
  try {
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.file(path.dirname(form.outputPath))
    );
    await vscode.workspace.fs.writeFile(
      outUri,
      new TextEncoder().encode(JSON.stringify(result, jsonReplacer, 2) + '\n')
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Could not write output: ${String(err)}`);
    return;
  }

  const doc = await vscode.workspace.openTextDocument(outUri);
  await vscode.window.showTextDocument(doc, { preview: false });
  vscode.window.showInformationMessage(
    `Graph executed → ${path.basename(outUri.fsPath)}`
  );
}
