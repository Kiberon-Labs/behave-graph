/**
 * Webview-side MCP tool registry.
 *
 * Plugins register tool definitions and handlers here. When the set
 * of tools changes, the registry notifies the extension host so that
 * MCP SDK tools can be created/removed dynamically.
 *
 * The registry also dispatches incoming `mcp:execute` messages to the
 * correct handler based on the command string.
 */

import type {
  McpToolDefinition,
  McpExecuteMessage,
  JsonSchemaInput
} from '../../src/mcp/types';
import type { MessageHandler } from './messageHandler';

// ---------------------------------------------------------------
// Handler type — what plugins provide for each tool
// ---------------------------------------------------------------

/**
 * A function that handles an MCP tool invocation on the webview side.
 * Receives the parsed arguments and returns the result (or throws).
 */
export type McpToolHandler = (
  args: Record<string, unknown>
) => unknown | Promise<unknown>;

// ---------------------------------------------------------------
// Registry entry (definition + handler)
// ---------------------------------------------------------------

interface ToolEntry {
  definition: McpToolDefinition;
  handler: McpToolHandler;
}

// ---------------------------------------------------------------
// McpRegistry
// ---------------------------------------------------------------

export class McpRegistry {
  private tools = new Map<string, ToolEntry>();
  private nexus: MessageHandler | null = null;

  /**
   * Bind the registry to the webview MessageHandler so it can
   * send `mcp:toolsChanged` notifications and respond to
   * `mcp:execute` messages.
   */
  attach(nexus: MessageHandler): void {
    this.nexus = nexus;

    nexus.on(
      'mcp:execute',
      async (payload: McpExecuteMessage, requestId?: number) => {
        if (!requestId) return;

        try {
          const result = await this.executeCommand(
            payload.command,
            payload.args
          );
          nexus.postResponse(requestId, { result });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          nexus.postResponse(requestId, { error: message });
        }
      }
    );
  }

  // ---------------------------------------------------------
  // Tool registration API (for plugins)
  // ---------------------------------------------------------

  /**
   * Register a tool.
   *
   * @param definition - Tool metadata (name, title, description,
   *   inputSchema). The `command` field defaults to `mcp:<name>`
   *   if omitted.
   * @param handler - The function that executes the tool.
   * @returns A dispose function that removes the tool.
   *
   * @example
   * ```ts
   * system.mcp.registerTool(
   *   {
   *     name: 'ai_suggest',
   *     title: 'AI Suggest',
   *     description: 'Use AI to suggest the next node',
   *     inputSchema: {
   *       prompt: {
   *         type: 'string',
   *         description: 'What the user wants',
   *       },
   *     },
   *   },
   *   async (args) => {
   *     const prompt = args.prompt as string;
   *     // ... do work
   *     return { suggestion: 'math/add' };
   *   }
   * );
   * ```
   */
  registerTool(
    definition: McpToolDefinition,
    handler: McpToolHandler
  ): () => void {
    const def = {
      ...definition,
      command: definition.command ?? `mcp:${definition.name}`
    };

    this.tools.set(def.name, { definition: def, handler });
    this.notifyToolsChanged();

    return () => {
      this.tools.delete(def.name);
      this.notifyToolsChanged();
    };
  }

  /**
   * Convenience overload: register a tool with inline parameters
   * instead of a pre-built definition object.
   */
  registerToolSimple(
    name: string,
    title: string,
    description: string,
    inputSchema: JsonSchemaInput | undefined,
    handler: McpToolHandler
  ): () => void {
    return this.registerTool(
      { name, title, description, inputSchema },
      handler
    );
  }

  /**
   * Check whether a tool with the given name is registered.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all current tool definitions (for sending to extension host).
   */
  getToolDefinitions(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map((e) => e.definition);
  }

  // ---------------------------------------------------------
  // Command execution (called by the mcp:execute handler)
  // ---------------------------------------------------------

  private async executeCommand(
    command: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Find by command string
    for (const entry of this.tools.values()) {
      if (entry.definition.command === command) {
        return entry.handler(args);
      }
    }
    throw new Error(`Unknown MCP command: ${command}`);
  }

  // ---------------------------------------------------------
  // Notify extension host of changes
  // ---------------------------------------------------------

  /**
   * Send the full tool list to the extension host so it can
   * synchronise MCP SDK registrations.
   */
  private notifyToolsChanged(): void {
    if (!this.nexus) return;
    this.nexus.postMessage('mcp:toolsChanged', {
      tools: this.getToolDefinitions()
    });
  }

  /**
   * Force a re-send of the tool list. Useful after the webview
   * reconnects or the extension host restarts.
   */
  resync(): void {
    this.notifyToolsChanged();
  }
}
