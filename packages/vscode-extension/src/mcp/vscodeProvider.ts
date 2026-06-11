/**
 * VS Code native MCP Server Definition Provider.
 *
 * Registers the Behave Graph MCP server with VS Code so that
 * Copilot Chat and other VS Code-internal agents can discover and
 * use the tools without any external configuration.
 *
 * This provider tells VS Code: "there is an HTTP MCP server at
 * http://127.0.0.1:<port>/mcp" using `McpHttpServerDefinition`.
 * VS Code's built-in MCP client then connects to it.
 *
 * Requires VS Code >= 1.99 and the `mcpServerDefinitionProviders`
 * contribution point in package.json.
 */
import * as vscode from 'vscode';

const PROVIDER_ID = 'kiberon-labs-behave-graph.mcp';

export class BehaveGraphMcpDefinitionProvider
  implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition>
{
  private _onDidChange = new vscode.EventEmitter<void>();

  readonly onDidChangeMcpServerDefinitions = this._onDidChange.event;

  private _port: number;
  private _enabled: boolean;

  constructor(port: number, enabled: boolean) {
    this._port = port;
    this._enabled = enabled;
  }

  /**
   * Update the port / enabled state and notify VS Code.
   */
  public update(port: number, enabled: boolean): void {
    this._port = port;
    this._enabled = enabled;
    this._onDidChange.fire();
  }

  // -- McpServerDefinitionProvider ---------------------------------

  provideMcpServerDefinitions(
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.McpHttpServerDefinition[]> {
    if (!this._enabled) {
      return [];
    }

    const uri = vscode.Uri.parse(`http://127.0.0.1:${this._port}/mcp`);

    return [
      new vscode.McpHttpServerDefinition(
        'Behave Graph Editor',
        uri,
        {},
        '1.0.0'
      )
    ];
  }

  // -- Lifecycle ---------------------------------------------------

  /**
   * Register with VS Code and return a disposable that cleans up.
   */
  public static register(
    port: number,
    enabled: boolean
  ): {
    provider: BehaveGraphMcpDefinitionProvider;
    disposable: vscode.Disposable;
  } {
    const provider = new BehaveGraphMcpDefinitionProvider(port, enabled);
    const disposable = vscode.lm.registerMcpServerDefinitionProvider(
      PROVIDER_ID,
      provider
    );
    return { provider, disposable };
  }
}
