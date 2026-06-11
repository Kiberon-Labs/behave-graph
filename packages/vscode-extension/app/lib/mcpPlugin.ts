/**
 * MCP plugin for the webview.
 *
 * Exposes `system.mcp` (an McpRegistry instance) so that other
 * plugins can register MCP tools dynamically. Also registers the
 * built-in graph-editing tools.
 *
 * Usage in index.tsx:
 *
 *   import { initMcpPlugin } from './lib/mcpPlugin';
 *
 *   const mcpPlugin = initMcpPlugin(nexus);
 *   system.registerPlugin(mcpPlugin);
 *
 * After registration, other plugins can do:
 *
 *   system.mcp.registerTool({ ... }, handler);
 */
import type { System } from '@kiberon-labs/behave-graph-flow';
import type { MessageHandler } from './messageHandler';
import { McpRegistry } from './mcpRegistry';
import { registerBuiltinTools } from './mcpHandler';

/**
 * Module augmentation so TypeScript knows about `system.mcp`.
 * This follows the same pattern used by the graphrunner plugin
 * for `system.runner`.
 */
declare module '@kiberon-labs/behave-graph-flow' {
  interface System {
    mcp: McpRegistry;
  }
}

/**
 * Create the MCP plugin, pre-bound to a MessageHandler.
 *
 * We need the nexus before the System is available, so this
 * is a factory that returns the plugin loader object.
 */
export function initMcpPlugin(nexus: MessageHandler) {
  return {
    loader: (system: System) => {
      const registry = new McpRegistry();

      // Attach to the message handler for communication with
      // the extension host (receive mcp:execute, send
      // mcp:toolsChanged).
      registry.attach(nexus);

      // Decorate System so plugins can access the registry.
      system.decorate('mcp', registry);

      // Register the built-in graph-editing tools.
      registerBuiltinTools(registry, system);
    },
    opts: { name: 'mcp' }
  };
}
