/**
 * Transport abstraction for the Graph Runner client
 * Allows different transport implementations (WebSocket, HTTP, SSE, etc.)
 */

import type { GraphRunnerMessage, ServerGraphRunnerMessage } from './types';

export type TransportState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface TransportConfig {
  url: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export interface ITransport<
  Send = ServerGraphRunnerMessage | GraphRunnerMessage,
  Receive = GraphRunnerMessage | ServerGraphRunnerMessage
> {
  /**
   * Get current connection state
   */
  getState(): TransportState;

  /**
   * Connect to the server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the server
   */
  disconnect(): void;

  /**
   * Send a message to the server
   */
  send(message: Send): void;

  /**
   * Register a message handler
   */
  onMessage(handler: (message: Receive) => void): void;

  /**
   * Register a connection state change handler
   */
  onStateChange(handler: (state: TransportState) => void): void;

  /**
   * Register an error handler
   */
  onError(handler: (error: Error) => void): void;

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void;
}

/**
 * Optional capability: a transport that can interactively control a run
 * (pause / resume / step). Remote transports may not support it; the client
 * detects support via {@link supportsExecutionControl} rather than reaching into
 * transport internals.
 */
export interface IExecutionControl {
  pauseExecution(runId: string): void;
  resumeExecution(runId: string): Promise<void>;
  stepExecution(runId: string): Promise<void>;
  isPaused(runId: string): boolean;
}

/** Type guard: does this transport implement {@link IExecutionControl}? */
export function supportsExecutionControl(
  transport: unknown
): transport is IExecutionControl {
  return (
    !!transport &&
    typeof (transport as IExecutionControl).pauseExecution === 'function' &&
    typeof (transport as IExecutionControl).resumeExecution === 'function' &&
    typeof (transport as IExecutionControl).stepExecution === 'function'
  );
}

/**
 * WebSocket transport implementation
 */
export class WebSocketTransport
  implements ITransport<GraphRunnerMessage, ServerGraphRunnerMessage>
{
  private ws: WebSocket | null = null;
  private config: Required<TransportConfig>;
  private state: TransportState = 'disconnected';
  private messageHandlers: Array<(message: ServerGraphRunnerMessage) => void> =
    [];
  private stateChangeHandlers: Array<(state: TransportState) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;

  constructor(config: TransportConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval ?? 5000,
      heartbeatInterval: config.heartbeatInterval ?? 30000
    };
  }

  getState(): TransportState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.setState('connecting');
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.setState('connected');
        this.startHeartbeat();
        resolve();
      };

      this.ws.onerror = () => {
        this.setState('error');
        const error = new Error('WebSocket connection error');
        this.notifyError(error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  send(message: GraphRunnerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: (message: ServerGraphRunnerMessage) => void): void {
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

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ServerGraphRunnerMessage = JSON.parse(event.data);
      this.messageHandlers.forEach((handler) => handler(message));
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.notifyError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private handleDisconnect(): void {
    this.setState('disconnected');
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Auto-reconnect
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = window.setTimeout(() => {
        this.reconnectTimeout = null;
        this.reconnect();
      }, this.config.reconnectInterval);
    }
  }

  private async reconnect(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.send({ type: 'ping', timestamp: Date.now() });
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }
}
