import { Body, Controller, Post } from '@nestjs/common';
import { AirportMcpToolsService, AirportSearchResult } from './airport-mcp-tools.service';

interface AirportChatRequest {
  message?: string;
}

interface AirportChatResponse {
  reply: string;
  airports: AirportSearchResult[];
}

@Controller('api/airport-chat')
export class AirportChatController {
  constructor(private readonly airportMcpToolsService: AirportMcpToolsService) {}

  @Post()
  async chat(@Body() body: AirportChatRequest): Promise<AirportChatResponse> {
    const message = body.message?.trim() ?? '';

    if (!message) {
      return {
        reply: 'Tell me a city and I will look for nearby airports.',
        airports: [],
      };
    }

    const query = this.extractAirportQuery(message);
    let airports: AirportSearchResult[];

    try {
      airports = await this.airportMcpToolsService.searchAirports(query);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown airport search error.';

      return {
        reply: `I understood "${query}", but the airport search backend failed: ${errorMessage}`,
        airports: [],
      };
    }

    if (airports.length === 0) {
      return {
        reply: `I searched for nearby airports for "${query}", but I did not find any matches.`,
        airports,
      };
    }

    const airportNames = airports.map((airport) => `${airport.name} (${airport.code})`).join(', ');

    return {
      reply: `Nearby airport options for ${query}: ${airportNames}.`,
      airports,
    };
  }

  private extractAirportQuery(message: string): string {
    const query = message
      .replace(/^(find|show|get|search)\s+/i, '')
      .replace(/\b(airports?|near|nearby|around|closest|to|in|for)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return query || message;
  }
}
