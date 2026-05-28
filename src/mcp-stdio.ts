import { NestFactory } from '@nestjs/core';
import type { StdioServerTransport as StdioTransportType } from '@modelcontextprotocol/sdk/server/stdio';
import { McpAppModule } from './mcp-entry/mcp-app.module';
import { McpToolsService } from './mcp-entry/mcp-tools.service';

const nodePath = require('path') as typeof import('path');
const serverCjsDir = nodePath.dirname(require.resolve('@modelcontextprotocol/sdk/server'));
const { StdioServerTransport } = require(nodePath.join(serverCjsDir, 'stdio.js')) as {
  StdioServerTransport: new () => StdioTransportType;
};

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(McpAppModule, { logger: false });
  const mcpTools = appContext.get(McpToolsService);

  const server = mcpTools.createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void bootstrap();
