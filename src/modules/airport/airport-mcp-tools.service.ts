import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from '../graphql-client/graphql-client.service';

@Injectable()
export class AirportMcpToolsService {
  private readonly logger = new Logger(AirportMcpToolsService.name);

  constructor(private readonly graphqlClientService: GraphqlClientService) {}

  registerTools() {
    this.logger.log('Airport MCP tools placeholder ready. search_airports will be added here.');
    void this.graphqlClientService;
  }
}
