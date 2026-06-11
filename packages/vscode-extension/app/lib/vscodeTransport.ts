/**
 * VSCode message-based transport for Graph Runner
 * Uses VSCode's webview message passing instead of WebSockets
 */

import { GraphRunnerMessage } from '@kiberon-labs/behave-graph-flow';
import { getVSCodeApi } from './vscodeApi';

export type TransportState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ITransport {
  getState(): TransportState;
  connect(): Promise<void>;
  disconnect(): void;
  send(message: GraphRunnerMessage): void;
  onMessage(handler: (message: GraphRunnerMessage) => void): void;
  onStateChange(handler: (state: TransportState) => void): void;
  onError(handler: (error: Error) => void): void;
  removeAllHandlers(): void;
}

/**
 * VSCode webview transport implementation
 * Communicates with the extension host via VSCode's message passing API
 */
export class VSCodeTransport implements ITransport {
  private vscode: ReturnType<typeof getVSCodeApi>;
  private state: TransportState = 'disconnected';
  private messageHandlers: Array<(message: GraphRunnerMessage) => void> = [];
  private stateChangeHandlers: Array<(state: TransportState) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  public messageListener:
    | ((event: { type: string; body: GraphRunnerMessage }) => void)
    | null = null;

  constructor() {
    this.vscode = getVSCodeApi();
  }

  getState(): TransportState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'connected') {
      return;
    }
    console.log('VSCodeTransport: connecting...');

    this.setState('connecting');

    // Set up message listener for incoming messages from extension
    this.messageListener = (event: {
      type: string;
      body: GraphRunnerMessage;
    }) => {
      console.log('VSCodeTransport: received message', event);
      const message = event;

      // Handle graph runner messages
      if (message.type === 'graphRunner' && message.body) {
        this.handleMessage(message.body);
      }
    };

    // window.addEventListener('message', this.messageListener);

    // Mark as connected immediately since there's no actual connection handshake
    this.setState('connected');
    console.log('VSCodeTransport: connecting...');
  }

  disconnect(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    this.setState('disconnected');
  }

  send(message: GraphRunnerMessage): void {
    if (this.state !== 'connected') {
      throw new Error('Transport is not connected');
    }

    // Send message to extension host
    this.vscode.postMessage({
      type: 'graphRunner',
      body: message
    });
  }

  onMessage(handler: (message: GraphRunnerMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onStateChange(handler: (state: TransportState) => void): void {
    this.stateChangeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  removeAllHandlers(): void {
    this.messageHandlers = [];
    this.stateChangeHandlers = [];
    this.errorHandlers = [];
  }

  private setState(state: TransportState): void {
    this.state = state;
    this.stateChangeHandlers.forEach((handler) => handler(state));
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  private handleMessage(message: GraphRunnerMessage): void {
    try {
      this.messageHandlers.forEach((handler) => handler(message));
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.notifyError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
