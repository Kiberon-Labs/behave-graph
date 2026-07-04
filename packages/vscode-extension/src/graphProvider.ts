/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystem } from './capabilities/fs.js';
import { MessageHandler } from './messageHandler.js';
import { GraphDocument } from './document.js';
import { disposeAll } from './dispose.js';
import { getNonce } from './nonce.js';
import { loadEditorPlugin } from './editorPlugin.js';
import { getExecutableGraphTracker } from './extension.js';
import { ServerManager } from './server/manager.js';
import type { UIGraphJSON } from '@kiberon-labs/behave-graph-flow';
import { getEditorBridge } from './extension.js';
import {
  resolveEditorSettings,
  writeEditorSettings,
  type EditorSettingsFile
} from './settings.js';
import type { McpToolsChangedMessage } from './mcp/types.js';

const PREFIX = path.join('build');

/**
 * A toast to surface in the webview editor. Mirrors the flow `Notifications`
 * API so the webview can pass it straight to `system.notifications.notify`.
 */
type WebviewNotification = {
  type: 'info' | 'success' | 'error' | 'loading';
  message: string;
  options?: { id?: string; duration?: number };
};

/**
 * Provider for Graph editors.
 *
 * Graph editors are used for `.kbgraph` files, which are just `.json` files with a different file extension.
 *
 * This provider demonstrates:
 *
 * - How to implement a custom editor for binary files.
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Communication between VS Code and the custom editor.
 * - Using CustomDocuments to store information that is shared between multiple custom editors.
 * - Implementing save, undo, redo, and revert.
 * - Backing up a custom editor.
 */
export class GraphProvider
  implements vscode.CustomEditorProvider<GraphDocument>
{
  private static newTsGraphFileId = 1;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.graph.new',
      () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage(
            'Creating new KLB Graph files currently requires opening a workspace'
          );
          return;
        }

        const uri = vscode.Uri.joinPath(
          workspaceFolders[0].uri,
          `new-${GraphProvider.newTsGraphFileId++}.kbgraph`
        ).with({ scheme: 'untitled' });

        vscode.commands.executeCommand(
          'vscode.openWith',
          uri,
          GraphProvider.viewType
        );
      }
    );

    return vscode.window.registerCustomEditorProvider(
      GraphProvider.viewType,
      new GraphProvider(context),
      {
        // For this demo extension, we enable `retainContextWhenHidden` which keeps the
        // webview alive even when it is not visible. You should avoid using this setting
        // unless is absolutely required as it does have memory overhead.
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  private static readonly viewType = 'kiberon-labs-behave-graph.graphFile';

  /**
   * Tracks all known webviews
   */
  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<GraphDocument> {
    const document: GraphDocument = await GraphDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          const webviewsForDocument = Array.from(
            this.webviews.get(document.uri)
          );
          if (!webviewsForDocument.length) {
            throw new Error('Could not find webview to save for');
          }

          const panel = webviewsForDocument[0];

          const response =
            await panel.messageHandler.postMessageWithResponse<string>(
              'getFileData',
              {}
            );
          const data = new TextEncoder().encode(response);
          return data;
        }
      }
    );

    const listeners: vscode.Disposable[] = [];

    listeners.push(
      document.onDidChange((e) => {
        // Tell VS Code that the document has been edited by the use.
        this._onDidChangeCustomDocument.fire({
          document,
          ...e
        });
      })
    );

    listeners.push(
      document.onDidChangeContent((e) => {
        // Update all webviews when the document changes
        for (const webviewPanel of this.webviews.get(document.uri)) {
          webviewPanel.messageHandler.postMessage('update', {
            edits: e.edits,
            content: e.content
          });
        }
      })
    );

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: GraphDocument,
    webviewPanel: vscode.WebviewPanel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true
    };

    // Eagerly re-evaluate this graph's executability so Execute Graph un-greys
    // as soon as it opens, without waiting for the full workspace scan.
    void getExecutableGraphTracker()?.refresh(document.uri);

    // Get the directory of the document for resolving relative paths
    const documentDir =
      document.uri.scheme === 'untitled'
        ? (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd())
        : path.dirname(document.uri.fsPath);

    // Collect load-time problems (failed plugin/registry transpile, missing
    // workspace transpiler, registry import errors) and surface them in the
    // editor as toasts. Errors raised before the webview is listening are
    // queued and flushed once it posts 'ready'; later ones are sent live.
    let webviewReady = false;
    const pendingNotifications: WebviewNotification[] = [];
    const notifyWebview = (notification: WebviewNotification) => {
      if (webviewReady) {
        webviewPanel.webview.postMessage({
          type: 'notification',
          body: notification
        });
      } else {
        pendingNotifications.push(notification);
      }
    };
    const errorMessage = (err: unknown) =>
      err instanceof Error ? err.message : String(err);

    // Load an adjacent editor plugin (plugin.js/.mjs/.ts/.tsx). TypeScript is
    // transpiled on demand, and the result is inlined into the webview so no
    // build step or extra resource roots are needed.
    let pluginScript: string | undefined;
    try {
      const loaded = await loadEditorPlugin(documentDir);
      if (loaded) {
        pluginScript = loaded.code;
        console.log(`Loaded editor plugin from ${loaded.sourcePath}`);
      }
    } catch (err) {
      console.error('Failed to load editor plugin:', err);
      notifyWebview({
        type: 'error',
        message: `Failed to load editor plugin: ${errorMessage(err)}`,
        options: { duration: 10000 }
      });
    }

    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      pluginScript
    );

    // Push the graph data + settings to the webview the instant it signals
    // 'ready'. This is deliberately wired *before* the run server is created and
    // initialised below: rendering the nodes needs only the serialized graph
    // (already in `document.documentData`), not the run server or the runner
    // connection. Registering this listener up front means the graph paints as
    // soon as the bundle loads, in parallel with the server spinning up.
    let initialStateSent = false;
    const sendInitialState = () => {
      if (initialStateSent) return;
      initialStateSent = true;

      // The webview's handlers are now live: flush any load errors queued
      // before it was ready, and route future ones straight through.
      webviewReady = true;
      for (const notification of pendingNotifications) {
        webviewPanel.webview.postMessage({
          type: 'notification',
          body: notification
        });
      }
      pendingNotifications.length = 0;

      // Resolve the cascading editor settings (local → global) and push them.
      void resolveEditorSettings(documentDir)
        .then((merged) =>
          webviewPanel.webview.postMessage({ type: 'settings', body: merged })
        )
        .catch((err) =>
          console.error('Failed to resolve editor settings', err)
        );

      if (document.uri.scheme === 'untitled') {
        webviewPanel.webview.postMessage({
          type: 'init',
          body: { untitled: true, editable: true }
        });
        return;
      }

      const editable = vscode.workspace.fs.isWritableFileSystem(
        document.uri.scheme
      );
      const data = JSON.parse(
        new TextDecoder().decode(document.documentData)
      ) as UIGraphJSON;
      webviewPanel.webview.postMessage({
        type: 'init',
        body: {
          value: {
            ...data,
            name: vscode.workspace.asRelativePath(document.uri)
          } as UIGraphJSON,
          editable
        }
      });
    };

    webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.type === 'ready') sendInitialState();
    });

    // Create a dedicated server for this document in IPC mode
    const serverManager = new ServerManager(
      {
        enableTrace: true,
        enableValidation: true,
        enableGraphRegistry: true,
        enableRuntimeMetadata: true,
        customRegistryPath: './registry.ts'
      },
      documentDir
    );

    // Wait for server initialization. A failure here is almost always a custom
    // registry that could not be transpiled/imported (bad TypeScript, a missing
    // workspace transpiler, a throwing module). Surface it as a toast and keep
    // the editor open: the graph still renders (its data came from the early
    // 'ready' path), only execution against the custom registry is unavailable.
    try {
      await serverManager.waitForInit();
      console.log(
        `GraphRunner server started for ${document.uri.toString()} in IPC mode`
      );
    } catch (err) {
      console.error('Failed to initialise graph runner server:', err);
      notifyWebview({
        type: 'error',
        message: `Failed to load graph registry: ${errorMessage(err)}`,
        // Persist until dismissed: execution is broken until the user fixes it.
        options: { id: 'registry-load-error', duration: Infinity }
      });
    }

    const messageHandler = new MessageHandler(
      webviewPanel,
      document,
      serverManager
    );

    // Add the webview to our internal set of active webviews
    const entry = this.webviews.add(document.uri, webviewPanel, messageHandler);

    new FileSystem(entry);

    // Editor settings file: project-local file lives at the workspace folder,
    // falling back to the document's directory.
    const settingsSaveDir =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ??
      documentDir;

    // Persist editor settings sent from the webview to the local rc file.
    messageHandler.on('saveSettings', async (body: EditorSettingsFile) => {
      try {
        await writeEditorSettings(settingsSaveDir, body);
      } catch (err) {
        console.error('Failed to write editor settings file', err);
      }
    });

    // Register this editor with the MCP bridge so MCP tools can
    // send commands to this webview.
    const bridge = getEditorBridge();
    const docUri = document.uri.toString();
    bridge.registerEditor(docUri, messageHandler);

    // Listen for tool-list changes from the webview MCP plugin
    // and relay them to the MCP server via the bridge.
    messageHandler.on('mcp:toolsChanged', (body: McpToolsChangedMessage) => {
      bridge.handleToolsChanged(body);
    });

    // Track focus changes so the bridge knows which editor is active
    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        bridge.setActiveEditor(docUri);
      }
    });

    // Clean up server when webview is disposed
    webviewPanel.onDidDispose(() => {
      console.log(`Disposing server for ${document.uri.toString()}`);
      bridge.unregisterEditor(docUri);
      serverManager.dispose();
    });

    // The graph data + settings are pushed by the early 'ready' listener wired
    // right after the HTML above, so nothing to send here: the webview always
    // drives the handshake by posting 'ready' once its handlers are registered.
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<GraphDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  public async saveCustomDocument(
    document: GraphDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    // Get the latest graph data from the webview
    const webviewsForDocument = Array.from(this.webviews.get(document.uri));
    if (webviewsForDocument.length > 0) {
      const panel = webviewsForDocument[0];
      try {
        const response = await panel.messageHandler.postMessageWithResponse<{
          value: UIGraphJSON;
        }>('getFileData', {});

        const graphData = response.value;
        // Update the document with the latest data
        document.makeEdit({ json: graphData });
      } catch (error) {
        console.error('Failed to get file data from webview:', error);
        // Continue with save using existing document data
      }
    }
    return document.save(cancellation);
  }

  public async saveCustomDocumentAs(
    document: GraphDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    // Get the latest graph data from the webview
    const webviewsForDocument = Array.from(this.webviews.get(document.uri));
    if (webviewsForDocument.length > 0) {
      const panel = webviewsForDocument[0];
      try {
        const response = await panel.messageHandler.postMessageWithResponse<{
          value: UIGraphJSON;
        }>('getFileData', {});
        const graphData = response.value;
        // Update the document with the latest data
        document.makeEdit({ json: graphData });
      } catch (error) {
        console.error('Failed to get file data from webview:', error);
        // Continue with save using existing document data
      }
    }
    return document.saveAs(destination, cancellation);
  }

  public revertCustomDocument(
    document: GraphDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.revert(cancellation);
  }

  public backupCustomDocument(
    document: GraphDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  //#endregion

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(
    webview: vscode.Webview,
    pluginScript?: string
  ): string {
    // Read the vite manifest fresh on every open. `require()` caches by path in
    // the extension host, so after the webview assets are rebuilt (new hashes)
    // it would keep serving the old, now-deleted file names.
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          this._context.extensionPath,
          PREFIX,
          '.vite',
          'manifest.json'
        ),
        'utf8'
      )
    );
    const mainScript = manifest['index.html']['file'];

    const styles = manifest['index.html']['css']
      .map((style: string) => {
        const styleUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(this._context.extensionPath, PREFIX, style))
        );

        return `<link rel="stylesheet" type="text/css" href="${styleUri}">`;
      })
      .join('\n');

    // The entry statically imports the split vendor chunks (react-dom,
    // reactflow, vscode-elements). Without a hint the browser only discovers
    // them after parsing the entry, fetching them serially. Emit
    // `modulepreload` links so they download in parallel with the entry.
    const collectImports = (key: string, acc: Set<string>): Set<string> => {
      for (const dep of manifest[key]?.imports ?? []) {
        if (acc.has(dep)) continue;
        acc.add(dep);
        collectImports(dep, acc);
      }
      return acc;
    };
    const preloads = Array.from(collectImports('index.html', new Set<string>()))
      .map((key) => manifest[key]?.file as string | undefined)
      .filter((file): file is string => Boolean(file))
      .map((file) => {
        const uri = webview.asWebviewUri(
          vscode.Uri.file(path.join(this._context.extensionPath, PREFIX, file))
        );
        return `<link rel="modulepreload" href="${uri}">`;
      })
      .join('\n');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, PREFIX, mainScript)
      )
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce or from workspace.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}' ${webview.cspSource};style-src vscode-resource: 'unsafe-inline' http: https: data:;">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${styles}
                ${preloads}
				<title>Graph</title>
                 <base href="${webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, PREFIX)))}">
					<style nonce="${nonce}">
						/* Instant paint: a lightweight loading state shown until the
						   editor bundle parses and React mounts into #root, which
						   replaces this content. Keeps the webview from reading as a
						   blank panel while the (large) app chunk loads.

						   Both animations below are driven purely by transform, so they
						   run on the compositor thread and keep moving even while the
						   main thread is busy parsing/executing the app bundle. */
						.bg-boot {
							position: fixed;
							inset: 0;
							display: flex;
							flex-direction: column;
							align-items: center;
							justify-content: center;
							gap: 16px;
							color: var(--vscode-descriptionForeground, #8a8a8a);
							font-family: var(--vscode-font-family, sans-serif);
						}
						.bg-boot__spinner {
							width: 30px;
							height: 30px;
							border: 3px solid var(--vscode-editorWidget-border, #3c3c3c);
							border-top-color: var(--vscode-progressBar-background, #0e70c0);
							border-radius: 50%;
							animation: bg-boot-spin 0.8s linear infinite;
						}
						.bg-boot__label {
							font-size: 13px;
							letter-spacing: 0.02em;
						}
						/* Indeterminate progress bar: a segment slides across a track. */
						.bg-boot__track {
							position: relative;
							width: 180px;
							height: 2px;
							overflow: hidden;
							border-radius: 2px;
							background: var(--vscode-editorWidget-border, #3c3c3c);
						}
						.bg-boot__track::before {
							content: '';
							position: absolute;
							inset: 0;
							width: 40%;
							border-radius: 2px;
							background: var(--vscode-progressBar-background, #0e70c0);
							animation: bg-boot-slide 1.3s ease-in-out infinite;
						}
						@keyframes bg-boot-spin {
							to { transform: rotate(360deg); }
						}
						@keyframes bg-boot-slide {
							from { transform: translateX(-110%); }
							to { transform: translateX(360%); }
						}
					</style>
			</head>
			<body>
	            <noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root">
					<div class="bg-boot">
						<div class="bg-boot__spinner"></div>
						<div class="bg-boot__label">Loading graph editor...</div>
						<div class="bg-boot__track"></div>
					</div>
				</div>${
          pluginScript
            ? `
				<script nonce="${nonce}">${pluginScript.replace(
          /<\/script/gi,
          '<\\/script'
        )}</script>`
            : ''
        }
				<script  type="module" nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export type WebviewObject = {
  readonly resource: string;
  readonly messageHandler: MessageHandler;
  readonly webviewPanel: vscode.WebviewPanel;
};

/**
 * Tracks all webviews.
 */
class WebviewCollection {
  private readonly _webviews = new Set<WebviewObject>();

  /**
   * Get all known webviews for a given uri.
   */
  public *get(uri: vscode.Uri): Iterable<WebviewObject> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry;
      }
    }
  }

  /**
   * Get all known webviews for a given uri.
   */
  public *getWebview(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  public *getHandler(uri: vscode.Uri): Iterable<MessageHandler> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.messageHandler;
      }
    }
  }

  /**
   * Add a new webview to the collection.
   */
  public add(
    uri: vscode.Uri,
    webviewPanel: vscode.WebviewPanel,
    messageHandler: MessageHandler
  ) {
    const entry = { resource: uri.toString(), webviewPanel, messageHandler };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
    return entry;
  }
}
