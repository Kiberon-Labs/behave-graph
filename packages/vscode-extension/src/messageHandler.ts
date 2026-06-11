/* eslint-disable @typescript-eslint/no-explicit-any */
import { GraphDocument } from './document';
import { WebviewPanel } from 'vscode';
import type { ServerManager } from './server/manager';
import {
  GraphRunnerMessage,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';

type Callback = (message: any, requestId?: number) => void;

type IPCMessage = {
  type: string;
  body: any;
};

export class MessageHandler {
  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private handlers = new Map<string, Callback[]>();

  private document: GraphDocument;
  private webview: WebviewPanel;
  private serverManager: ServerManager;

  constructor(
    webview: WebviewPanel,
    document: GraphDocument,
    serverManager: ServerManager
  ) {
    this.document = document;
    this.webview = webview;
    this.serverManager = serverManager;

    webview.webview.onDidReceiveMessage((e) => this.onMessage(e));

    // Register server-related message handlers
    this.registerServerHandlers();

    // Set up IPC transport message routing
    this.setupIPCTransport();
  }

  private setupIPCTransport(): void {
    // Set up bidirectional IPC communication
    this.serverManager.setSender((message: ServerGraphRunnerMessage) => {
      // Forward server messages to webview
      this.postMessage('graphRunner', message);
    });

    // Handle graph runner messages from webview
    this.on('graphRunner', (message: GraphRunnerMessage) => {
      // Forward to server via IPC
      this.serverManager.receive(message);
    });
  }

  private registerServerHandlers(): void {
    // Server is now in IPC mode, no URLs needed
    this.on('getServerStatus', (message, requestId) => {
      if (requestId) {
        this.postResponse(requestId, {
          running: this.serverManager.isRunning(),
          mode: 'ipc'
        });
      }
    });
  }

  public postMessage(type: string, body?: any): void {
    this.webview.webview.postMessage({ type, body });
  }

  public postResponse(requestId: number, body: any = null): void {
    this.webview.webview.postMessage({ type: 'response', requestId, body });
  }
  public postErrorResponse(requestId: number, body: any = null): void {
    this.webview.webview.postMessage({
      type: 'response',
      requestId,
      body,
      error: true
    });
  }

  public postMessageWithResponse<R = unknown>(
    type: string,
    body: any
  ): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>((resolve) =>
      this._callbacks.set(requestId, resolve)
    );
    this.webview.webview.postMessage({ type, requestId, body });
    return p;
  }

  public on(type: string, callback: Callback) {
    this.handlers.set(type, [...(this.handlers.get(type) || []), callback]);
    return () => this.off(type, callback);
  }

  public off(type: string, callback: Callback) {
    this.handlers.set(
      type,
      (this.handlers.get(type) || []).filter((cb) => cb !== callback)
    );
  }

  private onMessage(message: IPCMessage) {
    switch (message.type) {
      case 'response':
        this.onResponse(message);
        break;
      case 'graphRunner': {
        const handlers = this.handlers.get(message.type);

        handlers?.forEach((handler) =>
          handler(message.body, message.body.requestId)
        );
        break;
      }
      default: {
        // Dispatch to any registered .on() handlers (e.g.
        // 'mcp:toolsChanged', 'ready', etc.)
        const handlers = this.handlers.get(message.type);
        handlers?.forEach((handler) =>
          handler(message.body, (message as any).requestId)
        );
        break;
      }
    }
  }

  private onResponse(message: any) {
    const callback = this._callbacks.get(message.requestId);
    callback?.(message.body);
    this._callbacks.delete(message.requestId);
  }
}
