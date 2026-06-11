import type { ILogger } from '@kiberon-labs/behave-graph';
import { send } from './utils';
import {
  GraphRunnerMessage,
  ITransport,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';
import { ServerTransport } from './types';

/**
 * Logger implementation that captures log events and sends them to the client
 */
export class TransportLogger implements ILogger {
  constructor(
    private transport: ServerTransport | null = null,
    private runId: string | null = null,
    private graphId: string | null = null
  ) {}

  setContext(transport: ServerTransport, runId: string, graphId: string): void {
    this.transport = transport;
    this.runId = runId;
    this.graphId = graphId;
  }

  clearContext(): void {
    this.transport = null;
    this.runId = null;
    this.graphId = null;
  }

  log(message: string, data?: unknown): void {
    console.info(message, data);
    this.sendLog('info', message, data);
  }

  warning(message: string, data?: unknown): void {
    console.warn(message, data);
    this.sendLog('warning', message, data);
  }

  error(message: string, data?: unknown): void {
    console.error(message, data);
    this.sendLog('error', message, data);
  }

  verbose(message: string, data?: unknown): void {
    console.debug(message, data);
    this.sendLog('verbose', message, data);
  }

  private sendLog(level: string, message: string, data?: unknown): void {
    if (this.transport && this.runId && this.graphId) {
      send(this.transport, {
        type: 'log',
        runId: this.runId,
        graphId: this.graphId,
        level,
        message,
        data
      });
    }
  }
}
