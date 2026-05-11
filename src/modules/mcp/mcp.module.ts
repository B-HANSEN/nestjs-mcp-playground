import { Module } from '@nestjs/common';
import { AirportModule } from '../airport/airport.module';
import { McpServerService } from './mcp-server.service';

@Module({
  imports: [AirportModule],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpModule {}
