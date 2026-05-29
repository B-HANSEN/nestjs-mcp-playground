import { Injectable } from '@nestjs/common';
import type { McpServer as McpServerType } from '@modelcontextprotocol/sdk/server/mcp';
import { AirportService } from '../modules/airport/airport.service';
import { HotelRecommendationService } from '../modules/hotel/hotel-recommendation.service';
import { RecommendHotelsInput } from '../modules/hotel/hotel.types';
import { z } from 'zod/v4';

const nodePath = require('path') as typeof import('path');
const serverCjsDir = nodePath.dirname(require.resolve('@modelcontextprotocol/sdk/server'));
const { McpServer } = require(nodePath.join(serverCjsDir, 'mcp.js')) as {
  McpServer: typeof McpServerType;
};

@Injectable()
export class McpToolsService {
  constructor(
    private readonly airportService: AirportService,
    private readonly hotelService: HotelRecommendationService,
  ) {}

  createServer(): InstanceType<typeof McpServer> {
    const server = new McpServer({ name: 'travel-mcp', version: '0.1.0' });

    server.registerTool(
      'search_airports',
      {
        description: 'Search departure airports in the DACH region (Germany, Austria, Switzerland) and neighboring countries. Use this to find where a traveller can fly FROM, not to find destination airports.',
        inputSchema: {
          query: z.string().describe('City, place, or airport name. Example: Berlin'),
        },
      },
      async ({ query }) => {
        const results = await this.airportService.searchAirports(query);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      },
    );

    server.registerTool(
      'recommend_hotels',
      {
        description:
          'Create an actionable hotel search URL from traveller needs. Returns a search URL, not hotel cards.',
        inputSchema: {
          destinationQuery: z.string().optional().describe('Destination name, e.g. "Mallorca", "Ägypten"'),
          startDate: z.string().optional().describe('YYYY-MM-DD'),
          endDate: z.string().optional().describe('YYYY-MM-DD'),
          durationNights: z.number().optional(),
          rooms: z
            .array(
              z.object({
                adults: z.number(),
                childAges: z.array(z.number()).optional(),
              }),
            )
            .optional()
            .describe('Default: one room with 2 adults'),
          maxPriceEur: z
            .number()
            .optional()
            .describe('Max nightly budget in EUR for all rooms combined. Convert from other currencies if needed.'),
          beachfront: z.boolean().optional(),
          nearBeach: z.boolean().optional(),
          pool: z.boolean().optional(),
          familyFriendly: z.boolean().optional(),
          babyCot: z.boolean().optional(),
          quietHotel: z.boolean().optional(),
          minStars: z.number().min(1).max(5).optional(),
          boardTypes: z.array(z.string()).optional(),
          roomTypes: z.array(z.string()).optional(),
          seaView: z.boolean().optional(),
        },
      },
      async (args) => {
        const input: RecommendHotelsInput = {
          destinationQuery: args.destinationQuery,
          startDate: args.startDate,
          endDate: args.endDate,
          durationNights: args.durationNights,
          rooms: args.rooms ?? [{ adults: 2 }],
          maxPriceEur: args.maxPriceEur,
          beachfront: args.beachfront,
          nearBeach: args.nearBeach,
          pool: args.pool,
          familyFriendly: args.familyFriendly,
          babyCot: args.babyCot,
          quietHotel: args.quietHotel,
          minStars: args.minStars as RecommendHotelsInput['minStars'],
          boardTypes: args.boardTypes as RecommendHotelsInput['boardTypes'],
          roomTypes: args.roomTypes as RecommendHotelsInput['roomTypes'],
          seaView: args.seaView,
        };
        const result = await this.hotelService.recommendHotels(input);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    return server;
  }
}
