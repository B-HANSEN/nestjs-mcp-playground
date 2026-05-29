import express from 'express';
import { NestFactory } from '@nestjs/core';
import type { StreamableHTTPServerTransport as StreamableHTTPTransportType } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { McpAppModule } from './mcp-entry/mcp-app.module';
import { McpToolsService } from './mcp-entry/mcp-tools.service';

const nodePath = require('path') as typeof import('path');
const serverCjsDir = nodePath.dirname(require.resolve('@modelcontextprotocol/sdk/server'));
const { StreamableHTTPServerTransport } = require(nodePath.join(serverCjsDir, 'streamableHttp.js')) as {
  StreamableHTTPServerTransport: new (opts: { sessionIdGenerator: undefined }) => StreamableHTTPTransportType;
};

const MCP_PORT = 3001;

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(McpAppModule, { logger: false });
  const mcpTools = appContext.get(McpToolsService);

  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    const apiKey = process.env.API_KEY;
    if (apiKey && _req.headers['x-api-key'] !== apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  // Each POST is stateless: fresh transport + server per request
  app.post('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = mcpTools.createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // GET opens an SSE stream — not supported in stateless mode
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'SSE not supported in stateless mode. Use POST /mcp for tool calls.' });
  });

  app.listen(MCP_PORT, () => {
    console.log(`MCP server listening on http://localhost:${MCP_PORT}/mcp`);
  });
}

void bootstrap();
