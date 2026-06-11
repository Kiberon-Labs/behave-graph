import {
  ErrorCode,
  GraphRunnerMessage,
  ITransport,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';
import type { Session } from './types';

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function send(
  transport: ITransport<ServerGraphRunnerMessage, GraphRunnerMessage>,
  message: ServerGraphRunnerMessage
): void {
  if (transport.getState() === 'connected') {
    transport.send(message);
  }
}

export function sendError(
  transport: ITransport<ServerGraphRunnerMessage, GraphRunnerMessage>,
  code: ErrorCode,
  message: string,
  extra?: {
    runId?: string;
    graphId?: string;
    nodeId?: string;
    details?: unknown;
  }
): void {
  send(transport, {
    type: 'error',
    code,
    message,
    ...extra
  });
}

export function validateSession(
  transport: ITransport<ServerGraphRunnerMessage, GraphRunnerMessage>,
  session: Session | undefined,
  _sessionId: string
): session is Session {
  if (!session) {
    sendError(transport, 'SESSION_NOT_FOUND', 'Session does not exist');
    return false;
  }

  if (Date.now() > session.expiresAt) {
    sendError(transport, 'SESSION_EXPIRED', 'Session timed out');
    return false;
  }

  return true;
}
