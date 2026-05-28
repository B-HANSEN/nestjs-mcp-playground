import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from '../graphql-client/graphql-client.service';
import { AmadeusHotelAttribute, AmadeusHotelDestinationInput, RecommendHotelsInput, RecommendHotelsResult } from './hotel.types';

const AMADEUS_HOTEL_SEARCH_URL_QUERY = `
  query AmadeusHotelSearchUrl($input: AmadeusHotelSearchInput!) {
    amadeusHotelSearchUrl(input: $input)
  }
`;

const AUTOSUGGEST_AMADEUS_QUERY = `
  query AutosuggestAmadeus($search: String!, $limit: Int) {
    autosuggestAmadeus(search: $search, limit: $limit) {
      ... on AutosuggestAmadeusMatchCountry {
        id
        type
        name
        countryISO3166
      }
      ... on AutosuggestAmadeusMatchDestination {
        id
        type
        name
        iffRegionId
        regionId
      }
      ... on AutosuggestAmadeusMatchCity {
        id
        type
        name
      }
    }
  }
`;

interface AmadeusHotelSearchUrlData {
  amadeusHotelSearchUrl: string;
}

interface AutosuggestAmadeusMatch {
  id: string;
  type?: string;
  name?: string;
  countryISO3166?: string;
  iffRegionId?: string;
  regionId?: string;
}

interface AutosuggestAmadeusData {
  autosuggestAmadeus: AutosuggestAmadeusMatch[];
}

@Injectable()
export class HotelRecommendationService {
  private readonly logger = new Logger(HotelRecommendationService.name);
  private readonly destinationCache = new Map<string, AmadeusHotelDestinationInput>();

  constructor(private readonly graphqlClientService: GraphqlClientService) {}

  async recommendHotels(input: RecommendHotelsInput): Promise<RecommendHotelsResult> {
    const resolvedDestination = input.destination ?? (await this.resolveDestination(input.destinationQuery));
    const enrichedInput = resolvedDestination ? { ...input, destination: resolvedDestination } : input;

    if (enrichedInput.maxPriceEur !== undefined) {
      const nights = typeof enrichedInput.durationNights === 'number' && enrichedInput.durationNights > 0 ? enrichedInput.durationNights : 7;
      this.logger.log(`maxPriceEur: ${enrichedInput.maxPriceEur} EUR/night × ${nights} nights = ${enrichedInput.maxPriceEur * nights} EUR total`);
    }

    const appliedFilters = this.toAmadeusHotelSearchInput(enrichedInput);
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
      limitations: this.limitations(enrichedInput),
    };
  }

  private async resolveDestination(query: string | undefined): Promise<AmadeusHotelDestinationInput | undefined> {
    if (!query) {
      return undefined;
    }

    const cacheKey = query.toLowerCase().trim();

    if (this.destinationCache.has(cacheKey)) {
      return this.destinationCache.get(cacheKey);
    }

    try {
      const data = await this.graphqlClientService.request<AutosuggestAmadeusData>(AUTOSUGGEST_AMADEUS_QUERY, {
        search: query,
        limit: 1,
      });

      const match = data.autosuggestAmadeus?.[0];

      if (!match?.type) {
        return undefined;
      }

      const destination: AmadeusHotelDestinationInput = {
        type: match.type,
        id: match.id,
        name: match.name,
        countryISO3166: match.countryISO3166,
        iffRegionId: match.iffRegionId,
        regionId: match.regionId,
      };

      this.destinationCache.set(cacheKey, destination);

      return destination;
    } catch (error) {
      this.logger.warn(`Destination autosuggest failed for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
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
      // IBE filters by total trip price. Multiply per-night budget by duration before
      // applying the internal unit conversion (price_url = maxPrice / 33.33 in EUR).
      const nights = typeof input.durationNights === 'number' && input.durationNights > 0 ? input.durationNights : 7;
      filters.maxPrice = Math.round(input.maxPriceEur * nights * 100 / 3);
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

    if (input.rooms?.some((room) => room.childAges?.includes(0))) {
      limitations.push('Baby support is represented by child age 0 and optionally BabyCot.');
    }

    if (input.maxPriceEur) {
      const nights = typeof input.durationNights === 'number' && input.durationNights > 0 ? input.durationNights : 7;
      limitations.push(`maxPrice of ${input.maxPriceEur} EUR/night × ${nights} nights = ${input.maxPriceEur * nights} EUR total was applied to the IBE filter.`);
    }

    return limitations;
  }
}
