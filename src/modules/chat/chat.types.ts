import { AirportSearchResult } from '../airport/airport-mcp-tools.service';
import { RecommendHotelsResult } from '../hotel/hotel.types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message?: string;
  messages?: ChatMessage[];
}

export interface ChatToolResult {
  toolName: 'search_airports' | 'recommend_hotels';
  input: Record<string, unknown>;
  output: unknown;
}

export interface ChatResponse {
  reply: string;
  airports: AirportSearchResult[];
  hotelRecommendations: RecommendHotelsResult[];
  toolResults: ChatToolResult[];
}
