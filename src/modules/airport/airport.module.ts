import { Module } from '@nestjs/common';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { AirportChatController } from './airport-chat.controller';
import { AirportMcpToolsService } from './airport-mcp-tools.service';

@Module({
  imports: [GraphqlClientModule],
  controllers: [AirportChatController],
  providers: [AirportMcpToolsService],
  exports: [AirportMcpToolsService],
})
export class AirportModule {}
