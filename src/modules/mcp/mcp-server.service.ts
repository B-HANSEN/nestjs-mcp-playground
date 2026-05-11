import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AirportMcpToolsService } from '../airport/airport-mcp-tools.service';

@Injectable()
export class McpServerService implements OnModuleInit {
  private readonly logger = new Logger(McpServerService.name);

  constructor(private readonly airportMcpToolsService: AirportMcpToolsService) {}

  onModuleInit() {
    this.logger.log('MCP server module initialized. Tools will be registered here.');
    this.airportMcpToolsService.registerTools();
  }
}
