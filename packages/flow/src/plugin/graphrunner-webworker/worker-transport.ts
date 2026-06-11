/**
 * Web Worker transport implementation for graph execution
 * Communicates with a Web Worker that executes graphs
 */

import type { GraphRunnerMessage } from '../graphrunner/types.js';
import type { ITransport, TransportState } from '../graphrunner/transport.js';

/**
 * Messages sent from main thread to worker
 */
type MainToWorkerMessage = {
  type: 'execute';
  message: GraphRunnerMessage;
};

/**
 * Messages sent from worker to main thread
 */
type WorkerToMainMessage =
  | {
      type: 'message';
      data: GraphRunnerMessage;
    }
  | {
      type: 'error';
      error: string;
    };

/**
 * Web Worker transport that delegates graph execution to a worker thread
 */
export class WorkerTransport implements ITransport {
  private state: TransportState = 'disconnected';
  private messageHandlers: Array<(message: GraphRunnerMessage) => void> = [];
  private stateChangeHandlers: Array<(state: TransportState) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private worker: Worker;

  constructor(worker: Worker) {
    this.worker = worker;
  }

  getState(): TransportState {
    console.log('Current transport state:', this.state);
    return this.state;
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    try {
      // Set up message handler
      this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      // Set up error handler
      this.worker.onerror = (error) => {
        this.notifyError(new Error(`Worker error: ${error.message}`));
      };

      this.setState('connected');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  disconnect(): void {
    this.worker.terminate();
    this.setState('disconnected');
  }

  send(message: GraphRunnerMessage): void {
    const workerMessage: MainToWorkerMessage = {
      type: 'execute',
      message
    };
    this.worker.postMessage(workerMessage);
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

  private setState(newState: TransportState): void {
    this.state = newState;
    this.stateChangeHandlers.forEach((handler) => handler(newState));
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  private notifyMessage(message: GraphRunnerMessage): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }

  private handleWorkerMessage(data: WorkerToMainMessage): void {
    switch (data.type) {
      case 'message':
        this.notifyMessage(data.data);
        break;
      case 'error':
        this.notifyError(new Error(data.error));
        break;
    }
  }
}
