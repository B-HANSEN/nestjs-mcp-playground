import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GraphqlError {
  message: string;
}

interface GraphqlResponse<TData> {
  data?: TData;
  errors?: GraphqlError[];
}

@Injectable()
export class GraphqlClientService {
  constructor(private readonly configService: ConfigService) {}

  get apiUrl(): string | undefined {
    return this.configService.get<string>('GRAPHQL_API_URL');
  }

  async request<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
    if (!this.apiUrl) {
      throw new Error('GRAPHQL_API_URL is not configured.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const brandId = this.configService.get<string>('GRAPHQL_BRAND_ID') ?? this.configService.get<string>('BRAND_ID');
    const locale = this.configService.get<string>('GRAPHQL_LOCALE') ?? this.configService.get<string>('LOCALE');

    if (brandId) {
      headers['x-brand-id'] = brandId;
    }

    if (locale) {
      headers['x-locale'] = locale;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `GraphQL API request failed with status ${response.status}: ${this.formatResponseText(responseText)}`,
      );
    }

    const payload = JSON.parse(responseText) as GraphqlResponse<TData>;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join('; '));
    }

    if (!payload.data) {
      throw new Error('GraphQL API returned no data.');
    }

    return payload.data;
  }

  private formatResponseText(responseText: string): string {
    if (!responseText.trim()) {
      return 'empty response body';
    }

    return responseText.length > 500 ? `${responseText.slice(0, 500)}...` : responseText;
  }
}
