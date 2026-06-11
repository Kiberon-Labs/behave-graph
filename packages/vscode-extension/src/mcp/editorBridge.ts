/**
 * Editor bridge — routes MCP tool calls to the active webview editor.
 *
 * The bridge maintains a reference to the currently-active editor's
 * MessageHandler and uses the postMessageWithResponse pattern to send
 * commands and await results.
 *
 * It also receives `mcp:toolsChanged` notifications from webviews
 * and relays them to the MCP server so SDK tool registrations stay
 * in sync.
 */
import type { MessageHandler } from '../messageHandler.js';
import type {
  McpResultMessage,
  McpToolDefinition,
  McpToolsChangedMessage
} from './types.js';

/** Timeout for waiting for a webview response (ms). */
const RESPONSE_TIMEOUT = 30_000;

/**
 * Callback invoked when the webview sends an updated tool list.
 */
export type ToolsChangedCallback = (tools: McpToolDefinition[]) => void;

export class EditorBridge {
  /**
   * Map of document URI → MessageHandler for all open editors.
   * Allows targeting a specific document's webview.
   */
  private editors = new Map<string, MessageHandler>();

  /**
   * The URI of the currently-active (focused) editor, if any.
   */
  private activeEditorUri: string | null = null;

  /**
   * Callback that the MCP server registers to receive tool list
   * updates from the webview.
   */
  private onToolsChanged: ToolsChangedCallback | null = null;

  /**
   * Set the callback that will be invoked when any webview sends
   * a `mcp:toolsChanged` message.  Typically called once during
   * extension activation to connect the bridge to the MCP server.
   */
  public setToolsChangedCallback(cb: ToolsChangedCallback): void {
    this.onToolsChanged = cb;
  }

  /**
   * Register a webview editor's message handler.
   */
  public registerEditor(documentUri: string, handler: MessageHandler): void {
    this.editors.set(documentUri, handler);
    // If this is the first editor, make it active by default
    if (this.editors.size === 1) {
      this.activeEditorUri = documentUri;
    }
  }

  /**
   * Unregister a webview editor's message handler (on dispose).
   */
  public unregisterEditor(documentUri: string): void {
    this.editors.delete(documentUri);
    if (this.activeEditorUri === documentUri) {
      // Fall back to first available editor, or null
      const first = this.editors.keys().next();
      this.activeEditorUri = first.done ? null : first.value;
    }
  }

  /**
   * Set the active editor by URI (called when a webview gains focus).
   */
  public setActiveEditor(documentUri: string): void {
    if (this.editors.has(documentUri)) {
      this.activeEditorUri = documentUri;
    }
  }

  /**
   * Returns true if there is at least one open editor.
   */
  public hasEditor(): boolean {
    return this.editors.size > 0;
  }

  /**
   * Get the active editor's document URI, or null.
   */
  public getActiveEditorUri(): string | null {
    return this.activeEditorUri;
  }

  /**
   * List all open editor URIs.
   */
  public getEditorUris(): string[] {
    return Array.from(this.editors.keys());
  }

  /**
   * Execute an MCP command against the active webview editor.
   *
   * Sends a `mcp:execute` message to the webview and waits for a
   * `mcp:result` response. Throws if no editor is open or the
   * command times out / returns an error.
   */
  public async executeCommand<T = unknown>(
    command: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const handler = this.getActiveHandler();
    if (!handler) {
      throw new Error(
        'No active graph editor is open. Open a .kbgraph file first.'
      );
    }

    const result = await Promise.race([
      handler.postMessageWithResponse<McpResultMessage>('mcp:execute', {
        command,
        args
      }),
      timeout(RESPONSE_TIMEOUT)
    ]);

    if (!result) {
      throw new Error(
        `MCP command '${command}' timed out after ${RESPONSE_TIMEOUT}ms`
      );
    }

    const msg = result as McpResultMessage;
    if (msg.error) {
      throw new Error(msg.error);
    }

    return msg.result as T;
  }

  /**
   * Called when a webview sends `mcp:toolsChanged`.  Relays the
   * tool definitions to the registered callback (MCP server).
   */
  public handleToolsChanged(message: McpToolsChangedMessage): void {
    this.onToolsChanged?.(message.tools);
  }

  // -----------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------

  private getActiveHandler(): MessageHandler | null {
    if (!this.activeEditorUri) return null;
    return this.editors.get(this.activeEditorUri) ?? null;
  }
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}
