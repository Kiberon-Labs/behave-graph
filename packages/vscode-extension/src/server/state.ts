import type { IRegistry } from '@kiberon-labs/behave-graph';
import type {
  ClientConnection,
  Session,
  GraphRun,
  RegisteredGraph,
  ServerTransport
} from './types';
import { ITransport } from '@kiberon-labs/behave-graph-flow';

/**
 * Server state management
 */
export class ServerState {
  public clients = new Map<string, ClientConnection>();
  public sessions = new Map<string, Session>();
  public runs = new Map<string, GraphRun>();
  public registeredGraphs = new Map<string, RegisteredGraph>();
  public runHistory: GraphRun[] = [];
  private nextClientId = 1;

  constructor(public registry: IRegistry) {}

  addClient(transport: ServerTransport): ClientConnection {
    const id = `client-${this.nextClientId++}`;
    const client: ClientConnection = {
      id,
      transport,
      authenticated: false,
      receivedHello: false
    };
    this.clients.set(id, client);
    return client;
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  getClientByTransport(transport: ITransport): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.transport === transport) {
        return client;
      }
    }
    return undefined;
  }

  createSession(
    sessionId: string,
    expirationMs: number,
    metadata?: Record<string, unknown>
  ): Session {
    const now = Date.now();
    const session: Session = {
      id: sessionId,
      metadata,
      createdAt: now,
      expiresAt: now + expirationMs,
      lastHeartbeat: now,
      activeRuns: new Set(),
      subscriptions: new Map()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  addRun(run: GraphRun): void {
    this.runs.set(run.runId, run);
  }

  getRun(runId: string): GraphRun | undefined {
    return this.runs.get(runId);
  }

  addToHistory(run: GraphRun, maxHistory = 1000): void {
    this.runHistory.push(run);
    if (this.runHistory.length > maxHistory) {
      this.runHistory.shift();
    }
  }

  getHistory(graphId?: string, limit = 10): GraphRun[] {
    let history = this.runHistory;
    if (graphId) {
      history = history.filter((r) => r.graphId === graphId);
    }
    return history.slice(-limit);
  }
}
