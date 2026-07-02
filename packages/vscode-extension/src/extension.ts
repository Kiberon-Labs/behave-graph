// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GraphProvider } from './graphProvider.js';
import { executeGraphFile } from './commands/exec.js';
import { ExecutableGraphTracker } from './executableGraphs.js';
import { globalSettingsPath, localSettingsPath } from './settings.js';
import {
  BehaveGraphMcpServer,
  EditorBridge,
  HttpTransportManager,
  BehaveGraphMcpDefinitionProvider
} from './mcp/index.js';

/** Shared editor bridge , singleton for the extension lifetime. */
let editorBridge: EditorBridge | undefined;

/** Tracks which graphs are subgraph-style (drives Execute Graph greying). */
let executableGraphTracker: ExecutableGraphTracker | undefined;

/** The executable-graph tracker, so the editor can eagerly re-evaluate the
 *  graph it is opening (un-greying Execute Graph without the full scan). */
export function getExecutableGraphTracker(): ExecutableGraphTracker | undefined {
  return executableGraphTracker;
}

/** MCP server instance (tool definitions, transport-agnostic). */
let mcpServer: BehaveGraphMcpServer | undefined;

/** HTTP transport for external MCP clients. */
let httpTransport: HttpTransportManager | undefined;

/** VS Code native MCP definition provider. */
let vscodeProviderDisposable: vscode.Disposable | undefined;
let vscodeProvider: BehaveGraphMcpDefinitionProvider | undefined;

/**
 * Returns the shared EditorBridge singleton. Created lazily on
 * first access so that GraphProvider can register editors.
 */
export function getEditorBridge(): EditorBridge {
  if (!editorBridge) {
    editorBridge = new EditorBridge();
  }
  return editorBridge;
}

// -----------------------------------------------------------
// Helper: read MCP settings from VS Code configuration
// -----------------------------------------------------------

interface McpSettings {
  httpEnabled: boolean;
  httpPort: number;
  vscodeProviderEnabled: boolean;
}

function getMcpSettings(): McpSettings {
  const config = vscode.workspace.getConfiguration('behaveGraph.mcp');
  return {
    httpEnabled: config.get<boolean>('httpServer.enabled', true),
    httpPort: config.get<number>('httpServer.port', 3100),
    vscodeProviderEnabled: config.get<boolean>('vscodeProvider.enabled', true)
  };
}

// -----------------------------------------------------------
// MCP lifecycle
// -----------------------------------------------------------

async function startMcp(
  bridge: EditorBridge,
  settings: McpSettings
): Promise<void> {
  // Create the server (registers all tools)
  mcpServer = new BehaveGraphMcpServer(bridge);

  // Connect the bridge to the server so that when webviews send
  // `mcp:toolsChanged`, the server's SDK registrations are updated.
  bridge.setToolsChangedCallback((tools) => {
    mcpServer?.syncTools(tools);
  });

  // 1. HTTP transport for external agents
  if (settings.httpEnabled) {
    httpTransport = new HttpTransportManager(
      mcpServer.server,
      settings.httpPort
    );
    try {
      await httpTransport.start();
      console.log(`[MCP] HTTP transport started on port ${settings.httpPort}`);
    } catch (err) {
      console.error('[MCP] Failed to start HTTP transport:', err);
      vscode.window.showWarningMessage(
        `Behave Graph MCP HTTP server failed to start on port ${settings.httpPort}. ` +
        `Is the port already in use?`
      );
      httpTransport = undefined;
    }
  }

  // 2. VS Code native MCP provider (for Copilot Chat)
  if (settings.vscodeProviderEnabled && settings.httpEnabled) {
    try {
      const reg = BehaveGraphMcpDefinitionProvider.register(
        settings.httpPort,
        true
      );
      vscodeProvider = reg.provider;
      vscodeProviderDisposable = reg.disposable;
      console.log('[MCP] VS Code MCP definition provider registered');
    } catch (err) {
      console.error('[MCP] Failed to register VS Code MCP provider:', err);
    }
  }
}

async function stopMcp(): Promise<void> {
  // Dispose VS Code provider
  if (vscodeProviderDisposable) {
    vscodeProviderDisposable.dispose();
    vscodeProviderDisposable = undefined;
    vscodeProvider = undefined;
  }

  // Stop HTTP transport
  if (httpTransport) {
    await httpTransport.stop();
    httpTransport = undefined;
  }

  mcpServer = undefined;
}

// -----------------------------------------------------------
// Editor settings file commands
// -----------------------------------------------------------

const DEFAULT_SETTINGS_CONTENT = `${JSON.stringify(
  { settings: {}, conversions: [] },
  null,
  2
)}\n`;

/** Open a settings file, creating it with an empty template if it doesn't exist. */
async function openSettingsFile(filePath: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.writeFile(
      uri,
      new TextEncoder().encode(DEFAULT_SETTINGS_CONTENT)
    );
  }
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}

// -----------------------------------------------------------
// Extension activation / deactivation
// -----------------------------------------------------------

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "kiberon-labs-behave-graph" is now active!'
  );
  context.subscriptions.push(GraphProvider.register(context));

  // Track which graphs are subgraph-style so the Execute Graph menu item can be
  // greyed out for graphs without an input/output contract.
  executableGraphTracker = new ExecutableGraphTracker(context);

  // Warm up esbuild (used to transpile registry.ts / plugin.ts on demand) so the
  // first graph that needs it doesn't pay the service cold-start latency.
  void import('esbuild')
    .then((es) => es.transform('', { loader: 'ts' }))
    .catch(() => {});

  /**
   * Execute a subgraph-style graph: prompt for inputs, run it, and write the
   * outputs to a <DATE>-<RUNID>.json next to the graph file.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.executeGraph',
      async (uri: vscode.Uri) => {
        if (!uri) return;
        await executeGraphFile(uri);
      }
    )
  );

  // Commands to open the editor settings files (rc-style local + global).
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.openGlobalSettings',
      () => openSettingsFile(globalSettingsPath())
    ),
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.openLocalSettings',
      async () => {
        const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!folder) {
          vscode.window.showErrorMessage(
            'Open a workspace folder to edit local editor settings.'
          );
          return;
        }
        await openSettingsFile(localSettingsPath(folder));
      }
    )
  );

  // -------------------------------------------------------
  // MCP Server , start transports based on settings
  // -------------------------------------------------------
  const bridge = getEditorBridge();
  const settings = getMcpSettings();

  startMcp(bridge, settings).catch((err) => {
    console.error('[MCP] Failed to start MCP server:', err);
  });

  // React to settings changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('behaveGraph.mcp')) {
        console.log('[MCP] Settings changed, restarting MCP server...');
        await stopMcp();
        const newSettings = getMcpSettings();
        await startMcp(bridge, newSettings);
      }
    })
  );

  // Command to show MCP server status
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.mcpStatus',
      () => {
        const editorCount = bridge.getEditorUris().length;
        const activeUri = bridge.getActiveEditorUri();
        const httpStatus = httpTransport
          ? `HTTP: port ${httpTransport.port}`
          : 'HTTP: off';
        const providerStatus = vscodeProvider
          ? 'VS Code provider: on'
          : 'VS Code provider: off';
        vscode.window.showInformationMessage(
          `MCP Server | ${httpStatus} | ${providerStatus} | ` +
          `Editors: ${editorCount} | Active: ${activeUri ?? 'none'}`
        );
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  // Stop MCP server and transports
  stopMcp().catch((err) => {
    console.error('[MCP] Error stopping MCP server:', err);
  });
}
