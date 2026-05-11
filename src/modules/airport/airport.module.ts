import { Module } from '@nestjs/common';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { AirportMcpToolsService } from './airport-mcp-tools.service';

@Module({
  imports: [GraphqlClientModule],
  providers: [AirportMcpToolsService],
  exports: [AirportMcpToolsService],
})
export class AirportModule {}
