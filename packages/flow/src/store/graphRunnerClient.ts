import { createStore } from 'zustand/vanilla';
import type { GraphRunnerClient } from '../plugin/graphrunner/client';
import type {
  AuthCredentials,
  GraphRunnerCapabilities,
  ServerVariable,
  ServerEvent
} from '../plugin/graphrunner/types';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

export interface ConnectionConfig {
  url: string;
  auth: AuthCredentials;
  autoReconnect: boolean;
}

export interface ConnectionInfo {
  serverId: string | null;
  userId: string | null;
  sessionId: string | null;
  authenticated: boolean;
  capabilities: GraphRunnerCapabilities | null;
}

export interface GraphRunnerClientStore {
  // Connection state
  connectionState:
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected';
  connectionConfig: ConnectionConfig;
  connectionInfo: ConnectionInfo;
  error: string | null;

  // Client instance
  client: GraphRunnerClient | null;

  // Server metadata
  serverVariables: ServerVariable[];
  serverEvents: ServerEvent[];
  nodeTypes: NodeSpecJSON[];

  // Actions
  setConnectionConfig: (config: Partial<ConnectionConfig>) => void;
  setClient: (client: GraphRunnerClient | null) => void;
  setConnectionState: (
    state: 'disconnected' | 'connecting' | 'authenticating' | 'connected'
  ) => void;
  setConnectionInfo: (info: Partial<ConnectionInfo>) => void;
  setError: (error: string | null) => void;
  setServerVariables: (variables: ServerVariable[]) => void;
  setServerEvents: (events: ServerEvent[]) => void;
  setNodeTypes: (nodeTypes: NodeSpecJSON[]) => void;
  clearServerMetadata: () => void;
}

export const graphRunnerClientStoreFactory = () => {
  return createStore<GraphRunnerClientStore>((set) => ({
    // Initial state
    connectionState: 'disconnected',
    connectionConfig: {
      url: '',
      auth: { type: 'none' },
      autoReconnect: true
    },
    connectionInfo: {
      serverId: null,
      userId: null,
      sessionId: null,
      authenticated: false,
      capabilities: null
    },
    error: null,
    client: null,
    serverVariables: [],
    serverEvents: [],
    nodeTypes: [],

    // Actions
    setConnectionConfig: (config) =>
      set((state) => ({
        connectionConfig: { ...state.connectionConfig, ...config }
      })),

    setClient: (client) => set({ client }),

    setConnectionState: (connectionState) => set({ connectionState }),

    setConnectionInfo: (info) =>
      set((state) => ({
        connectionInfo: { ...state.connectionInfo, ...info }
      })),

    setError: (error) => set({ error }),

    setServerVariables: (serverVariables) => set({ serverVariables }),

    setServerEvents: (serverEvents) => set({ serverEvents }),

    setNodeTypes: (nodeTypes) => set({ nodeTypes }),

    clearServerMetadata: () =>
      set({
        serverVariables: [],
        serverEvents: [],
        nodeTypes: []
      })
  }));
};
