import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from '../graphql-client/graphql-client.service';
import { AmadeusHotelAttribute, RecommendHotelsInput, RecommendHotelsResult } from './hotel.types';

const AMADEUS_HOTEL_SEARCH_URL_QUERY = `
  query AmadeusHotelSearchUrl($input: AmadeusHotelSearchInput!) {
    amadeusHotelSearchUrl(input: $input)
  }
`;

interface AmadeusHotelSearchUrlData {
  amadeusHotelSearchUrl: string;
}

@Injectable()
export class HotelRecommendationService {
  private readonly logger = new Logger(HotelRecommendationService.name);

  constructor(private readonly graphqlClientService: GraphqlClientService) {}

  async recommendHotels(input: RecommendHotelsInput): Promise<RecommendHotelsResult> {
    const appliedFilters = this.toAmadeusHotelSearchInput(input);
    this.logger.log(`Hotel recommendation search URL requested with filters: ${JSON.stringify(appliedFilters)}`);

    const data = await this.graphqlClientService.request<AmadeusHotelSearchUrlData>(
      AMADEUS_HOTEL_SEARCH_URL_QUERY,
      {
        input: appliedFilters,
      },
    );

    return {
      searchUrl: data.amadeusHotelSearchUrl,
      hotels: [],
      appliedFilters,
      limitations: this.limitations(input),
    };
  }

  private toAmadeusHotelSearchInput(input: RecommendHotelsInput): Record<string, unknown> {
    const filters: Record<string, unknown> = {};
    const hotelAttributes = this.toHotelAttributes(input);

    if (input.destination) {
      filters.destination = input.destination;
    }

    if (input.startDate) {
      filters.startDate = input.startDate;
    }

    if (input.endDate) {
      filters.endDate = input.endDate;
    }

    if (typeof input.durationNights === 'number') {
      filters.duration = String(input.durationNights);
    }

    if (input.rooms?.length) {
      filters.rooms = input.rooms.map((room) => ({
        numberOfAdults: room.adults,
        agesOfChildren: room.childAges ?? [],
      }));
    }

    if (typeof input.maxPriceEur === 'number') {
      filters.maxPrice = input.maxPriceEur;
    }

    if (hotelAttributes.length) {
      filters.hotelAttributes = hotelAttributes;
    }

    if (input.roomTypes?.length) {
      filters.roomTypes = input.roomTypes;
    }

    if (input.boardTypes?.length) {
      filters.boardTypes = input.boardTypes;
    }

    if (input.minStars) {
      filters.stars = input.minStars;
    }

    if (input.minRecommendationRate) {
      filters.hotelRecommendationRate = input.minRecommendationRate;
    }

    if (typeof input.seaView === 'boolean') {
      filters.seaView = input.seaView;
    }

    if (input.brands?.length) {
      filters.brands = input.brands;
    }

    return filters;
  }

  private toHotelAttributes(input: RecommendHotelsInput): AmadeusHotelAttribute[] {
    const attributes = new Set<AmadeusHotelAttribute>();

    if (input.beachfront) {
      attributes.add('Beachfront');
    }

    if (input.nearBeach) {
      attributes.add('NearBeach');
    }

    if (input.pool) {
      attributes.add('Pool');
    }

    if (input.familyFriendly) {
      attributes.add('FamilyFriendly');
      attributes.add('ChildFriendly');
    }

    if (input.babyCot) {
      attributes.add('BabyCot');
    }

    if (input.quietHotel) {
      attributes.add('QuietLocation');
    }

    return Array.from(attributes);
  }

  private limitations(input: RecommendHotelsInput): string[] {
    const limitations = [
      'Current GraphQL hotel search returns a URL, not hotel result cards.',
      'No direct quiet-room filter exists; QuietLocation is used as the closest available filter.',
    ];

    if (input.destinationQuery && !input.destination) {
      limitations.push('destinationQuery was not resolved to an Amadeus destination object yet.');
    }

    if (input.rooms?.some((room) => room.childAges?.includes(0))) {
      limitations.push('Baby support is represented by child age 0 and optionally BabyCot.');
    }

    if (input.maxPriceEur) {
      limitations.push('maxPrice is treated as EUR; the search input has no explicit currency field.');
    }

    return limitations;
  }
}
