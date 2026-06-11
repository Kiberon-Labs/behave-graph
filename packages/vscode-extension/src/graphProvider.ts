/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystem } from './capabilities/fs.js';
import { MessageHandler } from './messageHandler.js';
import { GraphDocument } from './document.js';
import { disposeAll } from './dispose.js';
import { getNonce } from './nonce.js';
import { ServerManager } from './server/manager.js';
import type { UIGraphJSON } from '@kiberon-labs/behave-graph-flow';
import { getEditorBridge } from './extension.js';
import type { McpToolsChangedMessage } from './mcp/types.js';

const PREFIX = path.join('build');

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

    // Get the directory of the document for resolving relative paths
    const documentDir =
      document.uri.scheme === 'untitled'
        ? (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd())
        : path.dirname(document.uri.fsPath);

    // Check if plugin.js exists in the workspace
    let pluginUri: vscode.Uri | undefined;
    const pluginPath = path.join(documentDir, 'plugin.js');
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(pluginPath));
      pluginUri = webviewPanel.webview.asWebviewUri(
        vscode.Uri.file(pluginPath)
      );
      console.log(`Found plugin.js at ${pluginPath}`);
    } catch {
      // plugin.js doesn't exist, that's okay
    }

    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      pluginUri
    );

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

    // Wait for server initialization
    await serverManager.waitForInit();

    console.log(
      `GraphRunner server started for ${document.uri.toString()} in IPC mode`
    );

    const messageHandler = new MessageHandler(
      webviewPanel,
      document,
      serverManager
    );

    // Add the webview to our internal set of active webviews
    const entry = this.webviews.add(document.uri, webviewPanel, messageHandler);

    new FileSystem(entry);

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

    webviewPanel.webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case 'ready':
          if (document.uri.scheme === 'untitled') {
            messageHandler.postMessage('init', {
              untitled: true,
              editable: true
            });
          } else {
            const editable = vscode.workspace.fs.isWritableFileSystem(
              document.uri.scheme
            );

            const data = JSON.parse(
              new TextDecoder().decode(document.documentData)
            ) as UIGraphJSON;
            messageHandler.postMessage('init', {
              value: {
                ...data,
                name: vscode.workspace.asRelativePath(document.uri)
              } as UIGraphJSON,
              editable
            });
          }
          break;
      }
    });
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
    pluginUri?: vscode.Uri
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manifest = require(
      path.join(this._context.extensionPath, PREFIX, '.vite', 'manifest.json')
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
				<title>Graph</title>
                 <base href="${webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, PREFIX)))}">
			</head>
			<body>
	            <noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>${
          pluginUri
            ? `
				<script nonce="${nonce}" src="${pluginUri}"></script>`
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
