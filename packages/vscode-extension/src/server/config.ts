import { AuthCredentials } from '@kiberon-labs/behave-graph-flow';

export interface ServerConfig {
  port?: number;
  protocolVersion?: string;
  serverId?: string;
  sessionExpirationMs?: number;
  maxConcurrentRuns?: number;
  authProvider?: (
    credentials: AuthCredentials
  ) => Promise<{ valid: boolean; userId?: string }>;
  enableTrace?: boolean;
  enableValidation?: boolean;
  enableGraphRegistry?: boolean;
  enableEventFiltering?: boolean;
  enableBatchOperations?: boolean;
  enableRunHistory?: boolean;
  enableRuntimeMetadata?: boolean;
  customRegistryPath?: string;
}

const defaultAuthProvider = async (
  credentials: AuthCredentials
): Promise<{ valid: boolean; userId?: string }> => {
  // Default: accept all connections with 'none' auth type
  if (credentials.type === 'none') {
    return { valid: true, userId: `anonymous-${Date.now()}` };
  }
  return { valid: false };
};

export function createDefaultConfig(
  config: ServerConfig = {}
): Required<ServerConfig> {
  return {
    port: config.port ?? 8080,
    protocolVersion: config.protocolVersion ?? '1.0.0',
    serverId: config.serverId ?? `server-${Date.now()}`,
    sessionExpirationMs: config.sessionExpirationMs ?? 3600000, // 1 hour
    maxConcurrentRuns: config.maxConcurrentRuns ?? 100,
    authProvider: config.authProvider ?? defaultAuthProvider,
    enableTrace: config.enableTrace ?? true,
    enableValidation: config.enableValidation ?? true,
    enableGraphRegistry: config.enableGraphRegistry ?? true,
    enableEventFiltering: config.enableEventFiltering ?? false,
    enableBatchOperations: config.enableBatchOperations ?? false,
    enableRunHistory: config.enableRunHistory ?? false,
    enableRuntimeMetadata: config.enableRuntimeMetadata ?? true,
    customRegistryPath: config.customRegistryPath ?? './registry.ts'
  };
}
