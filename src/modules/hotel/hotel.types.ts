export type AmadeusHotelAttribute =
  | 'Beachfront'
  | 'NearBeach'
  | 'Pool'
  | 'IndoorPool'
  | 'ChildrenPool'
  | 'Waterslide'
  | 'FamilyFriendly'
  | 'ChildFriendly'
  | 'BabyCot'
  | 'Playground'
  | 'MiniClub'
  | 'MaxiClub'
  | 'SmallFamilyResort'
  | 'GermanSpeakingChildcare'
  | 'QuietLocation';

export type AmadeusBoardType =
  | 'AllInclusive'
  | 'Breakfast'
  | 'HalfBoard'
  | 'FullBoard'
  | 'NoBoard'
  | 'SelfCatering';

export type AmadeusRoomType = 'DoubleRoom' | 'FamilyRoom' | 'Suite' | 'Apartment';
export type AmadeusBrand = string;

export interface AmadeusHotelDestinationInput {
  type: string;
  id?: string;
  name?: string;
  countryId?: string;
  countryISO3166?: string;
  iffCityId?: string;
  iffRegionId?: string;
  regionId?: string;
  suggestion?: string;
}

export interface RecommendHotelsInput {
  destination?: AmadeusHotelDestinationInput;
  destinationQuery?: string;
  startDate?: string;
  endDate?: string;
  durationNights?: number | 'exact';
  rooms: Array<{
    adults: number;
    childAges?: number[];
  }>;
  maxPriceEur?: number;
  beachfront?: boolean;
  nearBeach?: boolean;
  pool?: boolean;
  familyFriendly?: boolean;
  babyCot?: boolean;
  quietHotel?: boolean;
  minStars?: 1 | 2 | 3 | 4 | 5;
  minRecommendationRate?: 80 | 90 | 100;
  boardTypes?: AmadeusBoardType[];
  roomTypes?: AmadeusRoomType[];
  seaView?: boolean;
  brands?: AmadeusBrand[];
}

export interface NormalizedHotelResult {
  id: string;
  name: string;
  location?: string;
  imageUrl?: string;
  stars?: number;
  price?: {
    value: number;
    currency: string;
  };
  description?: string;
  amenities: string[];
  recommendationReasons: string[];
  detailsUrl?: string;
  bookingUrl?: string;
}

export interface RecommendHotelsResult {
  searchUrl: string;
  hotels: NormalizedHotelResult[];
  appliedFilters: Record<string, unknown>;
  limitations: string[];
}
