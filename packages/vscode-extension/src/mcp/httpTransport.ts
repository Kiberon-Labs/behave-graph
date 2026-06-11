/**
 * HTTP transport for the Behave Graph MCP server.
 *
 * Starts a local Node.js HTTP server that accepts Streamable HTTP
 * connections from any MCP client (Claude Desktop, OpenCode, Cursor,
 * etc.).  Each incoming request is forwarded to the MCP SDK's
 * `StreamableHTTPServerTransport` which handles the protocol framing.
 */
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export class HttpTransportManager {
  private httpServer: Server | null = null;
  private transport: StreamableHTTPServerTransport | null = null;
  private _port: number;

  constructor(
    private mcpServer: McpServer,
    port: number
  ) {
    this._port = port;
  }

  public get port(): number {
    return this._port;
  }

  /**
   * Start the HTTP server and connect the MCP server to a
   * StreamableHTTPServerTransport.
   */
  public async start(): Promise<void> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });

    this.httpServer = createServer(async (req, res) => {
      // Only accept requests to /mcp
      const url = new URL(req.url ?? '/', `http://localhost:${this._port}`);

      if (url.pathname !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found. MCP endpoint is at /mcp');
        return;
      }

      // Let the transport handle the request
      try {
        await this.transport!.handleRequest(req, res);
      } catch (err) {
        console.error('[MCP/HTTP] Error handling request:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal server error');
        }
      }
    });

    // Connect the MCP server to this transport
    await this.mcpServer.connect(this.transport);

    return new Promise<void>((resolve, reject) => {
      this.httpServer!.on('error', (err) => {
        console.error('[MCP/HTTP] Server error:', err);
        reject(err);
      });

      this.httpServer!.listen(this._port, '127.0.0.1', () => {
        console.log(
          `[MCP/HTTP] Behave Graph MCP server listening on http://127.0.0.1:${this._port}/mcp`
        );
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server and disconnect the transport.
   */
  public async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    if (this.httpServer) {
      return new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          console.log('[MCP/HTTP] Server stopped');
          this.httpServer = null;
          resolve();
        });
      });
    }
  }
}
