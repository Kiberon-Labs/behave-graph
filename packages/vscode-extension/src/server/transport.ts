import type {
  ITransport,
  GraphRunnerMessage,
  TransportState,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';
import { ServerTransport } from './types';

/**
 * IPC transport implementation for VSCode extension
 * Messages are sent directly via function calls, no serialization needed
 */
export class IPCTransport implements ServerTransport {
  private messageHandler?: (message: GraphRunnerMessage) => void;
  private closeHandler?: () => void;
  private errorHandler?: (error: Error) => void;
  private state: TransportState = 'connected';
  private stateChangeHandlers: Array<(state: TransportState) => void> = [];
  private sendToClient: (message: ServerGraphRunnerMessage) => void = (
    message
  ) => {
    // Placeholder, will be set via setSender
    console.warn('No sendToClient handler set for IPCTransport');
  };

  /**
   * Callback to send messages to the other side
   */
  constructor() {}
  getState(): TransportState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'disconnected') {
      this.setState('connecting');
      // Simulate async connection
      this.setState('connected');
    }
  }

  disconnect(): void {
    if (this.state !== 'disconnected') {
      this.setState('disconnected');
      this.closeHandler?.();
    }
  }

  onStateChange(handler: (state: TransportState) => void): void {
    this.stateChangeHandlers.push(handler);
  }

  removeAllHandlers(): void {
    this.messageHandler = undefined;
    this.closeHandler = undefined;
    this.errorHandler = undefined;
    this.stateChangeHandlers = [];
  }

  /**
   * Receive a message from the client
   */
  receiveFromClient(message: GraphRunnerMessage): void {
    if (this.state === 'connected') {
      try {
        this.messageHandler?.(message);
      } catch (error) {
        this.errorHandler?.(error as Error);
      }
    }
  }
  setSendToClientHandler(
    handler: (message: ServerGraphRunnerMessage) => void
  ): void {
    this.sendToClient = handler;
  }

  send(message: ServerGraphRunnerMessage): void {
    if (this.state === 'connected') {
      this.sendToClient(message);
    }
  }

  close(): void {
    if (this.state !== 'disconnected') {
      this.setState('disconnected');
      this.closeHandler?.();
    }
  }

  isOpen(): boolean {
    return this.state === 'connected';
  }

  onMessage(handler: (message: GraphRunnerMessage) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  private setState(newState: TransportState): void {
    if (this.state !== newState) {
      this.state = newState;
      for (const handler of this.stateChangeHandlers) {
        handler(newState);
      }
    }
  }
}
