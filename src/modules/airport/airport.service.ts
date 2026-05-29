import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphqlClientService } from '../graphql-client/graphql-client.service';

const DEFAULT_SEARCH_AIRPORTS_QUERY = `
  query SearchAirports($query: String!) {
    allAirports(limit: 8, filter: { name: $query, showLocaleSpecificAirports: true }) {
      iataCode
      name
      location {
        formatted
      }
    }
  }
`;

export interface AirportSearchResult {
  code: string;
  name: string;
  city: string;
  country: string;
  distanceLabel?: string;
}

type AirportSearchData = Record<string, unknown>;

@Injectable()
export class AirportService {
  private readonly logger = new Logger(AirportService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly graphqlClientService: GraphqlClientService,
  ) {}

  async searchAirports(query: string): Promise<AirportSearchResult[]> {
    this.logger.log(`Airport search requested for "${query}".`);

    const data = await this.graphqlClientService.request<AirportSearchData>(this.searchAirportsQuery, {
      query,
    });

    return this.normalizeAirportSearchResults(data);
  }

  private get searchAirportsQuery(): string {
    return this.configService.get<string>('GRAPHQL_AIRPORT_SEARCH_QUERY') ?? DEFAULT_SEARCH_AIRPORTS_QUERY;
  }

  private normalizeAirportSearchResults(data: AirportSearchData): AirportSearchResult[] {
    const rawResults = this.findAirportArray(data);

    return rawResults.map((rawAirport) => {
      const airport = rawAirport as Record<string, unknown>;

      return {
        code: this.asString(airport.code ?? airport.iataCode ?? airport.iata ?? airport.id, 'AIR'),
        name: this.asString(airport.name ?? airport.displayName, 'Airport'),
        city: this.asString(airport.city ?? airport.cityName ?? this.getLocationFormatted(airport), ''),
        country: this.asString(airport.country ?? airport.countryName, ''),
        distanceLabel: this.asOptionalString(airport.distanceLabel ?? airport.distance),
      };
    });
  }

  private getLocationFormatted(airport: Record<string, unknown>): string | undefined {
    const location = airport.location;

    if (!this.isRecord(location)) {
      return undefined;
    }

    return this.asOptionalString(location.formatted);
  }

  private findAirportArray(data: AirportSearchData): Record<string, unknown>[] {
    const knownKeys = ['allAirports', 'searchAirports', 'search_airports', 'airports', 'airportSearch'];

    for (const key of knownKeys) {
      const value = data[key];

      if (Array.isArray(value)) {
        return value.filter(this.isRecord);
      }
    }

    const firstArray = Object.values(data).find((value) => Array.isArray(value));

    if (!firstArray) {
      return [];
    }

    return firstArray.filter(this.isRecord);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  private asOptionalString(value: unknown): string | undefined {
    if (typeof value === 'number') {
      return `${Math.round(value)} km`;
    }

    return typeof value === 'string' && value.trim() ? value : undefined;
  }
}
