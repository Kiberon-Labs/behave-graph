/**
 * MCP Server for the Behave Graph VS Code extension.
 *
 * Exposes graph authoring, inspection, and execution tools via the
 * Model Context Protocol.  The server itself is transport-agnostic;
 * transports (HTTP, VS Code native) are managed externally and
 * connected via `server.connect(transport)`.
 *
 * Tools are registered **dynamically**: the webview sends a
 * `mcp:toolsChanged` message containing an array of
 * `McpToolDefinition` objects, and this class synchronises the
 * MCP SDK registrations to match.
 *
 * Two extension-host-only features are also registered:
 * - `search_tools`: lets agents search/filter the available tools
 * - A prompt that guides agents to use `search_tools` first.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EditorBridge } from './editorBridge.js';
import type {
  McpToolDefinition,
  JsonSchemaProperty,
  JsonSchemaInput
} from './types.js';

/**
 * Handle returned by McpServer.registerTool , lets us remove or
 * update the tool later.
 */
interface RegisteredToolHandle {
  remove(): void;
}

/**
 * A registered tool entry: the SDK handle (for lifecycle) plus
 * the original definition (for search_tools queries).
 */
interface ToolRegistration {
  handle: RegisteredToolHandle;
  definition: McpToolDefinition;
}

export class BehaveGraphMcpServer {
  /** The underlying MCP SDK server instance. */
  public readonly server: McpServer;

  /**
   * Tracks currently registered *webview* tools by name so we can
   * remove them when the webview sends an updated tool list.
   */
  private registeredTools = new Map<string, ToolRegistration>();

  constructor(private bridge: EditorBridge) {
    this.server = new McpServer({
      name: 'behave-graph',
      version: '1.0.0'
    });

    this.registerSearchTool();
    this.registerToolDiscoveryPrompt();
  }

  // -----------------------------------------------------------
  // Dynamic tool synchronisation
  // -----------------------------------------------------------

  /**
   * Called by the EditorBridge when the webview sends
   * `mcp:toolsChanged`.  Synchronises the set of MCP SDK tools
   * to match the definitions provided by the webview.
   */
  public syncTools(definitions: McpToolDefinition[]): void {
    const incoming = new Map(definitions.map((d) => [d.name, d]));

    // Remove tools that are no longer present
    for (const [name, reg] of this.registeredTools) {
      if (!incoming.has(name)) {
        reg.handle.remove();
        this.registeredTools.delete(name);
      }
    }

    // Add or update tools
    for (const [name, def] of incoming) {
      if (this.registeredTools.has(name)) {
        // Tool already registered , for simplicity we remove and
        // re-add so the description / schema are refreshed.
        this.registeredTools.get(name)!.handle.remove();
        this.registeredTools.delete(name);
      }
      const handle = this.registerToolFromDefinition(def);
      this.registeredTools.set(name, { handle, definition: def });
    }

    // Notify connected clients that the tool list changed
    this.server.sendToolListChanged();
  }

  // -----------------------------------------------------------
  // Extension-host-only tools
  // -----------------------------------------------------------

  /**
   * Registers the `search_tools` MCP tool on the extension host.
   *
   * This tool does NOT go through the webview , it reads the
   * `registeredTools` map directly to let agents discover tools
   * by name, description, category, or tags.
   */
  private registerSearchTool(): void {
    this.server.registerTool(
      'search_tools',
      {
        title: 'Search Tools',
        description:
          'Search and filter available behave-graph tools. ' +
          'Returns matching tools with their name, title, ' +
          'description, category, tags, and parameter schema. ' +
          'Use this to discover which tools are available ' +
          'before calling them. Omit all parameters to list ' +
          'every tool.',
        inputSchema: {
          query: z
            .string()
            .optional()
            .describe(
              'Free-text search string. Matches against tool ' +
                'name, title, description, category, and tags.'
            ),
          category: z
            .string()
            .optional()
            .describe(
              'Filter by category (e.g. "inspection", ' +
                '"authoring", "variables", "events", ' +
                '"editor", "execution").'
            )
        }
      },
      (args: Record<string, unknown>) => {
        const query = args.query as string | undefined;
        const category = args.category as string | undefined;

        let results = this.getAllToolDefinitions();

        // Filter by category (exact, case-insensitive)
        if (category) {
          const lowerCat = category.toLowerCase();
          results = results.filter(
            (d) => d.category?.toLowerCase() === lowerCat
          );
        }

        // Filter by free-text query (case-insensitive substring
        // match across name, title, description, category, tags)
        if (query) {
          const lowerQuery = query.toLowerCase();
          results = results.filter((d) => toolMatchesQuery(d, lowerQuery));
        }

        // Build a concise summary for each matching tool
        const summaries = results.map((d) => ({
          name: d.name,
          title: d.title,
          description: d.description,
          category: d.category ?? null,
          tags: d.tags ?? [],
          parameters: d.inputSchema
            ? Object.entries(d.inputSchema).map(([pName, pSchema]) => ({
                name: pName,
                type: pSchema.type ?? 'unknown',
                description: pSchema.description ?? null
              }))
            : []
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  totalTools: this.registeredTools.size,
                  matchCount: summaries.length,
                  tools: summaries
                },
                null,
                2
              )
            }
          ]
        };
      }
    );
  }

  /**
   * Returns all tool definitions from both webview-registered
   * tools and any extension-host-only tool metadata.
   */
  private getAllToolDefinitions(): McpToolDefinition[] {
    return Array.from(this.registeredTools.values()).map((r) => r.definition);
  }

  // -----------------------------------------------------------
  // MCP Prompt , tool discovery workflow
  // -----------------------------------------------------------

  /**
   * Registers a prompt that guides AI agents to use the
   * `search_tools` tool before calling other tools.
   */
  private registerToolDiscoveryPrompt(): void {
    this.server.registerPrompt(
      'tool_discovery',
      {
        title: 'Behave Graph Tool Discovery',
        description:
          'Explains the available tool categories and how ' +
          'to find the right tool using search_tools.'
      },
      () => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: TOOL_DISCOVERY_PROMPT
            }
          }
        ]
      })
    );
  }

  // -----------------------------------------------------------
  // Tool registration from a JSON-serializable definition
  // -----------------------------------------------------------

  private registerToolFromDefinition(
    def: McpToolDefinition
  ): RegisteredToolHandle {
    const command = def.command ?? `mcp:${def.name}`;
    const bridge = this.bridge;

    // Build a zod input schema from the JSON Schema description
    const inputSchema = def.inputSchema
      ? jsonSchemaInputToZod(def.inputSchema)
      : undefined;

    const handle = this.server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        ...(inputSchema ? { inputSchema } : {})
      },
      async (args: Record<string, unknown>) => {
        const result = await bridge.executeCommand(command, args);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
    );

    return handle;
  }
}

// ---------------------------------------------------------------
// Tool discovery prompt text
// ---------------------------------------------------------------

const TOOL_DISCOVERY_PROMPT = `\
You are interacting with the Behave Graph visual node editor via MCP tools.

There are many tools available, organized into these categories:

- **inspection** , Read graph state: get the full graph JSON, \
inspect individual nodes, list available node types, see the \
current selection.
- **authoring** , Modify the graph: add/remove nodes, \
connect/disconnect sockets, set parameters and configuration.
- **variables** , Create and remove graph variables.
- **events** , Create and remove custom events (with optional \
parameters).
- **editor** , Control the editor UI: save, auto-layout, \
zoom to fit, select nodes.
- **execution** , Run or stop graph execution.

## Workflow

1. **Start with \`search_tools\`** to find the right tool. \
You can search by keyword or filter by category. Omit all \
parameters to see every available tool.
2. **Read tool details** , the search result includes each \
tool's description and parameter schema so you know exactly \
what arguments to pass.
3. **Call the tool** , use the tool name from the search result.
4. **Inspect the result** , most tools return JSON describing \
what happened.

## Tips

- Use \`get_graph\` first to understand the current state.
- Use \`list_node_types\` (with optional category/search filters) \
to find which node types you can add.
- After making changes, use \`layout_graph\` and \`zoom_to_fit\` \
to keep the editor tidy.
- Always \`save_graph\` when you're done making changes.
`;

// ---------------------------------------------------------------
// Search helper
// ---------------------------------------------------------------

/**
 * Returns true if the tool definition matches the given
 * lowercase query string (substring match across multiple fields).
 */
function toolMatchesQuery(def: McpToolDefinition, lowerQuery: string): boolean {
  if (def.name.toLowerCase().includes(lowerQuery)) return true;
  if (def.title.toLowerCase().includes(lowerQuery)) return true;
  if (def.description.toLowerCase().includes(lowerQuery)) return true;
  if (def.category?.toLowerCase().includes(lowerQuery)) return true;
  if (def.tags?.some((t) => t.toLowerCase().includes(lowerQuery))) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------
// JSON Schema → Zod conversion helpers
//
// The webview describes tool inputs as plain JSON Schema objects
// (so they're serialisable).  The MCP SDK expects zod schemas.
// We do a best-effort conversion for the types that matter.
// ---------------------------------------------------------------

/**
 * Convert a JsonSchemaInput (map of property name → property
 * descriptor) to a zod raw shape suitable for the MCP SDK's
 * `inputSchema` option.
 */
function jsonSchemaInputToZod(
  input: JsonSchemaInput
): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, prop] of Object.entries(input)) {
    shape[key] = jsonSchemaPropertyToZod(prop);
  }
  return shape;
}

function jsonSchemaPropertyToZod(prop: JsonSchemaProperty): z.ZodType {
  let schema: z.ZodType;

  switch (prop.type) {
    case 'string':
      schema = z.string();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'integer':
      schema = z.number().int();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      if (prop.items) {
        schema = z.array(jsonSchemaPropertyToZod(prop.items));
      } else {
        schema = z.array(z.unknown());
      }
      break;
    case 'object':
      if (prop.properties) {
        const objShape: Record<string, z.ZodType> = {};
        const requiredSet = new Set(prop.required ?? []);
        for (const [k, v] of Object.entries(prop.properties)) {
          const fieldSchema = jsonSchemaPropertyToZod(v);
          objShape[k] = requiredSet.has(k)
            ? fieldSchema
            : fieldSchema.optional();
        }
        schema = z.object(objShape);
      } else {
        schema = z.record(z.string(), z.unknown());
      }
      break;
    default:
      // No type specified , accept anything
      schema = z.unknown();
      break;
  }

  // All top-level tool params should be optional unless the
  // caller explicitly marks them as required (handled at the
  // object level above).  For standalone properties we make
  // them optional so the MCP SDK doesn't reject calls that
  // omit optional fields.
  if (prop.description) {
    schema = schema.describe(prop.description);
  }

  return schema;
}
