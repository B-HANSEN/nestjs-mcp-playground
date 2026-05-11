import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GraphqlClientService {
  constructor(private readonly configService: ConfigService) {}

  get apiUrl(): string | undefined {
    return this.configService.get<string>('GRAPHQL_API_URL');
  }

  get apiToken(): string | undefined {
    return this.configService.get<string>('GRAPHQL_API_TOKEN');
  }
}
