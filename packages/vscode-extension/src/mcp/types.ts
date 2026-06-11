/**
 * Shared types for the MCP server, editor bridge, and webview.
 *
 * Defines the tool definition interface that both the extension host
 * and webview use to describe MCP tools. Tool definitions are
 * JSON-serializable so they can be sent over the webview message
 * channel.
 */

// ---------------------------------------------------------------
// JSON Schema subset used for tool input/output descriptions.
// Full JSON Schema is overkill — we only need what the MCP SDK
// translates from zod schemas.
// ---------------------------------------------------------------

/**
 * A simplified JSON Schema property descriptor.
 * Enough to describe tool parameters without importing zod on
 * the webview side.
 */
export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/**
 * JSON Schema object representing the input parameters for a tool.
 * Each key is a parameter name.
 */
export type JsonSchemaInput = Record<string, JsonSchemaProperty>;

// ---------------------------------------------------------------
// MCP tool definition — the extensible interface
// ---------------------------------------------------------------

/**
 * Describes an MCP tool that can be registered both on the webview
 * (for handling) and on the extension-host (for SDK registration).
 *
 * This is the unit of extensibility: plugins in the webview create
 * `McpToolDefinition` objects, the webview registry serialises them
 * to the extension host, and the extension host registers them with
 * the MCP SDK.
 */
export interface McpToolDefinition {
  /** Unique tool name (snake_case). Must not collide with others. */
  name: string;
  /** Short human-readable title. */
  title: string;
  /** Longer description shown to the AI agent. */
  description: string;
  /**
   * Input parameter schema as a JSON Schema property map.
   * Keys are parameter names, values describe the parameter.
   * Omit for zero-argument tools.
   */
  inputSchema?: JsonSchemaInput;
  /**
   * The command string sent in the `mcp:execute` envelope.
   * Defaults to `mcp:<name>` if not provided.
   */
  command?: string;
  /**
   * Logical category for grouping/filtering (e.g. "inspection",
   * "authoring", "execution"). Used by the `search_tools` tool.
   */
  category?: string;
  /**
   * Free-form tags for search/filtering (e.g. ["graph", "read"]).
   * Used by the `search_tools` tool.
   */
  tags?: string[];
}

// ---------------------------------------------------------------
// Messages between extension host and webview
// ---------------------------------------------------------------

/**
 * Envelope sent from extension host to webview for MCP commands.
 */
export interface McpExecuteMessage {
  command: string;
  args: Record<string, unknown>;
}

/**
 * Result envelope sent from webview back to extension host.
 */
export interface McpResultMessage {
  result?: unknown;
  error?: string;
}

/**
 * Sent from webview to extension host when the tool set changes.
 * Contains the full list of currently registered tools.
 */
export interface McpToolsChangedMessage {
  tools: McpToolDefinition[];
}
