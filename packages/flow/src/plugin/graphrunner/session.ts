/**
 * Session management for local graph runner
 * Allows customization of execution context and configuration per session
 */

import type { IRegistry } from '@kiberon-labs/behave-graph';
import type {
  GraphRunnerCapabilities,
  EventFilter
} from '../graphrunner/types.js';

/**
 * Session configuration for graph execution
 */
export interface SessionConfig {
  /** Custom metadata attached to the session */
  metadata?: Record<string, unknown>;
  /** Default execution options for all runs in this session */
  defaultExecutionOptions?: {
    autoEnd?: boolean;
    trace?: boolean;
    eventFilter?: EventFilter;
    maxExecutionTimeMs?: number;
  };
  /** Session-level execution settings */
  executionSettings?: {
    /** Delay between execution steps in milliseconds */
    stepDelay?: number;
    /** Execution speed multiplier (0.1 to 2.0) */
    executionSpeed?: number;
    /** Interval between tick events in milliseconds */
    tickInterval?: number;
    /** Maximum number of concurrent runs allowed */
    maxConcurrentRuns?: number;
  };
  /** Custom hook for handling tick timing/delays */
  tickStrategy?: () => Promise<void>;
  /** Custom registry overrides for this session */
  registryOverrides?: Partial<IRegistry>;
  /** Session lifecycle hooks */
  hooks?: SessionHooks;
  /** Session-specific capabilities override */
  capabilities?: Partial<GraphRunnerCapabilities>;
}

/**
 * Lifecycle hooks for session events
 */
export interface SessionHooks {
  /** Called when the session is created */
  onSessionCreated?: (session: Session) => void | Promise<void>;
  /** Called when a run starts in this session */
  onRunStarted?: (
    session: Session,
    runId: string,
    graphId: string
  ) => void | Promise<void>;
  /** Called when a run completes in this session */
  onRunCompleted?: (
    session: Session,
    runId: string,
    graphId: string,
    result: unknown
  ) => void | Promise<void>;
  /** Called when a run fails in this session */
  onRunError?: (
    session: Session,
    runId: string,
    graphId: string,
    error: Error
  ) => void | Promise<void>;
  /** Called when the session is closed */
  onSessionClosed?: (session: Session) => void | Promise<void>;
}

/**
 * Session state
 */
export interface Session {
  /** Unique session identifier */
  readonly sessionId: string;
  /** Session expiration timestamp */
  readonly expiresAt: number;
  /** Session creation timestamp */
  readonly createdAt: number;
  /** Session configuration */
  readonly config: SessionConfig;
  /** Active run IDs in this session */
  readonly activeRuns: Set<string>;
  /** Custom session state (user-definable) */
  state: Record<string, unknown>;
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Factory for creating sessions with custom configuration
 */
export interface SessionFactory {
  /**
   * Create a new session with optional configuration
   */
  createSession(sessionId: string, config?: SessionConfig): Session;
}

/**
 * Default session factory implementation
 */
export class DefaultSessionFactory implements SessionFactory {
  private defaultConfig?: SessionConfig;

  constructor(defaultConfig?: SessionConfig) {
    this.defaultConfig = defaultConfig;
  }

  createSession(sessionId: string, config?: SessionConfig): Session {
    const mergedConfig: SessionConfig = {
      ...this.defaultConfig,
      ...config,
      metadata: {
        ...this.defaultConfig?.metadata,
        ...config?.metadata
      },
      defaultExecutionOptions: {
        ...this.defaultConfig?.defaultExecutionOptions,
        ...config?.defaultExecutionOptions
      },
      executionSettings: {
        ...this.defaultConfig?.executionSettings,
        ...config?.executionSettings
      },
      hooks: {
        ...this.defaultConfig?.hooks,
        ...config?.hooks
      }
    };

    const session: Session = {
      sessionId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours default
      createdAt: Date.now(),
      config: mergedConfig,
      activeRuns: new Set(),
      state: {},
      metadata: mergedConfig.metadata ?? {}
    };

    // Call creation hook
    if (mergedConfig.hooks?.onSessionCreated) {
      void mergedConfig.hooks.onSessionCreated(session);
    }

    return session;
  }
}

/**
 * Session manager to track and manage multiple sessions
 */
export class SessionManager {
  private sessions = new Map<string, Session>();
  private sessionFactory: SessionFactory;

  constructor(sessionFactory?: SessionFactory) {
    this.sessionFactory = sessionFactory ?? new DefaultSessionFactory();
  }

  /**
   * Create a new session
   */
  createSession(sessionId: string, config?: SessionConfig): Session {
    const session = this.sessionFactory.createSession(sessionId, config);
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Close and remove a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Call close hook
      if (session.config.hooks?.onSessionClosed) {
        await session.config.hooks.onSessionClosed(session);
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Add a run to a session
   */
  addRunToSession(sessionId: string, runId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.activeRuns.add(runId);
    }
  }

  /**
   * Remove a run from a session
   */
  removeRunFromSession(sessionId: string, runId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.activeRuns.delete(runId);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        void this.closeSession(sessionId);
      }
    }
  }
}
