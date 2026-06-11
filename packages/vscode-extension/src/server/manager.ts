import { GraphRunnerServer } from './graph-runner-server';
import { IPCTransport } from './transport';
import type { ServerConfig } from './config';
import {
  GraphRunnerMessage,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';
import * as path from 'path';

/**
 * Manages the lifecycle of a GraphRunner server instance for a specific document
 * Uses IPC transport for communication with the webview
 */
export class ServerManager {
  private server!: GraphRunnerServer;
  private ipcTransport: IPCTransport;
  private initPromise: Promise<void>;

  constructor(config: ServerConfig = {}, baseDir?: string) {
    // Create IPC transport with a placeholder callback
    // This will be replaced when onIPCMessage is called
    this.ipcTransport = new IPCTransport();

    // Resolve custom registry path relative to base directory
    if (
      baseDir &&
      config.customRegistryPath &&
      !path.isAbsolute(config.customRegistryPath)
    ) {
      const resolvedPath = path.resolve(baseDir, config.customRegistryPath);
      console.log(
        `Resolving registry path: ${config.customRegistryPath} relative to ${baseDir} -> ${resolvedPath}`
      );
      config.customRegistryPath = resolvedPath;
    }

    // Initialize server asynchronously
    this.initPromise = GraphRunnerServer.create(this.ipcTransport, config).then(
      (server) => {
        this.server = server;
      }
    );
  }

  /**
   * Wait for server initialization to complete
   */
  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  public receive(message: GraphRunnerMessage): void {
    this.ipcTransport.receiveFromClient(message);
  }

  public setSender(sender: (message: ServerGraphRunnerMessage) => void): void {
    this.ipcTransport.setSendToClientHandler(sender);
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.ipcTransport !== null;
  }

  /**
   * Stop the server and clean up resources
   */
  public dispose(): void {
    if (this.ipcTransport) {
      this.ipcTransport.close();
      //@ts-ignore
      this.ipcTransport = null;
    }
    this.server.close();
  }
}
