import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AirportMcpToolsService, AirportSearchResult } from '../airport/airport-mcp-tools.service';
import { HotelRecommendationService } from '../hotel/hotel-recommendation.service';
import { AmadeusBoardType, AmadeusRoomType, RecommendHotelsInput, RecommendHotelsResult } from '../hotel/hotel.types';
import { ChatMessage, ChatRequest, ChatResponse, ChatToolResult } from './chat.types';

type AiProvider = 'local' | 'openai' | 'anthropic';

const AMADEUS_BOARD_TYPES = new Set<AmadeusBoardType>([
  'AllInclusive',
  'Breakfast',
  'HalfBoard',
  'FullBoard',
  'NoBoard',
  'SelfCatering',
]);

const AMADEUS_ROOM_TYPES = new Set<AmadeusRoomType>(['DoubleRoom', 'FamilyRoom', 'Suite', 'Apartment']);

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiChoice {
  message: OpenAiMessage;
}

interface OpenAiChatCompletion {
  choices?: OpenAiChoice[];
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;
type AnthropicUserContentBlock = AnthropicTextBlock | AnthropicToolResultBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[] | AnthropicUserContentBlock[];
}

interface AnthropicMessageResponse {
  content?: AnthropicContentBlock[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly systemPrompt = [
    'You are a helpful travel assistant.',
    'Use tools when the user asks for factual travel data, airports, hotel recommendations, packages, or availability.',
    'Available tools are search_airports and recommend_hotels.',
    'Do not invent airport or hotel results.',
    'The recommend_hotels tool currently returns an actionable hotel search URL, not hotel result cards.',
    'If recommend_hotels returns hotels: [], say that you prepared a hotel search link. Do not say you found specific hotels.',
    'A baby should be represented as child age 0 unless the user gives a different age.',
    'Keep answers concise and practical.',
  ].join(' ');

  constructor(
    private readonly configService: ConfigService,
    private readonly airportMcpToolsService: AirportMcpToolsService,
    private readonly hotelRecommendationService: HotelRecommendationService,
  ) {}

  getStatus() {
    return {
      provider: this.aiProvider,
      model: this.providerModel,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.normalizeMessages(request);
    const latestMessage = messages.at(-1)?.content.trim() ?? '';

    if (!latestMessage) {
      return {
        reply: 'Tell me where you want to travel from or what kind of trip you are planning.',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    if (this.aiProvider === 'openai') {
      return this.chatWithOpenAi(messages);
    }

    if (this.aiProvider === 'anthropic') {
      return this.chatWithAnthropic(messages);
    }

    return this.chatLocally(latestMessage);
  }

  private async chatLocally(message: string): Promise<ChatResponse> {
    if (this.shouldRecommendHotels(message)) {
      return this.recommendHotelsLocally(message);
    }

    const query = this.extractAirportQuery(message);

    if (!this.shouldSearchAirports(message, query)) {
      return {
        reply:
          'I can help with airport search and hotel search URLs now. Ask about an airport or describe the hotel you need.',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    try {
      const airports = await this.airportMcpToolsService.searchAirports(query);
      return this.airportSearchResponse(query, airports, [
        {
          toolName: 'search_airports',
          input: { query },
          output: airports,
        },
      ]);
    } catch (error) {
      return {
        reply: `I understood "${query}", but the airport search backend failed: ${this.errorMessage(error)}`,
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }
  }

  private async recommendHotelsLocally(message: string): Promise<ChatResponse> {
    const input = this.recommendHotelsInputFromMessage(message);

    try {
      const result = await this.hotelRecommendationService.recommendHotels(input);

      return {
        reply: `I prepared a hotel search link with the matching filters I could infer. Open the search URL to view live hotel results.`,
        airports: [],
        hotelRecommendations: [result],
        toolResults: [
          {
            toolName: 'recommend_hotels',
            input: input as unknown as Record<string, unknown>,
            output: result,
          },
        ],
      };
    } catch (error) {
      return {
        reply: `I understood the hotel request, but the hotel search backend failed: ${this.errorMessage(error)}`,
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }
  }

  private async chatWithOpenAi(messages: ChatMessage[]): Promise<ChatResponse> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      return {
        reply: 'AI_PROVIDER is set to openai, but OPENAI_API_KEY is not configured.',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    const model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
    const openAiMessages = this.toOpenAiMessages(messages);
    const firstCompletion = await this.createOpenAiCompletion(apiKey, model, openAiMessages, true);
    const firstMessage = firstCompletion.choices?.[0]?.message;

    if (!firstMessage) {
      return {
        reply: 'The AI provider returned no response.',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    if (!firstMessage.tool_calls?.length) {
      return {
        reply: firstMessage.content ?? '',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    const toolResults: ChatToolResult[] = [];
    const airports: AirportSearchResult[] = [];
    const hotelRecommendations: RecommendHotelsResult[] = [];
    const toolMessages: OpenAiMessage[] = [];

    for (const toolCall of firstMessage.tool_calls) {
      if (!['search_airports', 'recommend_hotels'].includes(toolCall.function.name)) {
        continue;
      }

      const input = this.parseToolInput(toolCall.function.arguments);

      const result =
        toolCall.function.name === 'search_airports'
          ? await this.callSearchAirportsTool(input, messages.at(-1)?.content ?? '', airports, toolResults)
          : await this.callRecommendHotelsTool(input, messages.at(-1)?.content ?? '', hotelRecommendations, toolResults);

      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    return {
      reply: this.fallbackReply(airports, hotelRecommendations),
      airports,
      hotelRecommendations,
      toolResults,
    };
  }

  private async chatWithAnthropic(messages: ChatMessage[]): Promise<ChatResponse> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      return {
        reply: 'AI_PROVIDER is set to anthropic, but ANTHROPIC_API_KEY is not configured.',
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    const model = this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
    const anthropicMessages = this.toAnthropicMessages(messages);
    const firstCompletion = await this.createAnthropicMessage(apiKey, model, anthropicMessages, true);
    const toolUseBlocks = this.getAnthropicToolUseBlocks(firstCompletion);

    if (!toolUseBlocks.length) {
      return {
        reply: this.getAnthropicText(firstCompletion),
        airports: [],
        hotelRecommendations: [],
        toolResults: [],
      };
    }

    const toolResults: ChatToolResult[] = [];
    const airports: AirportSearchResult[] = [];
    const hotelRecommendations: RecommendHotelsResult[] = [];
    const toolResultBlocks: AnthropicToolResultBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      if (!['search_airports', 'recommend_hotels'].includes(toolUse.name)) {
        continue;
      }

      const result =
        toolUse.name === 'search_airports'
          ? await this.callSearchAirportsTool(toolUse.input, messages.at(-1)?.content ?? '', airports, toolResults)
          : await this.callRecommendHotelsTool(toolUse.input, messages.at(-1)?.content ?? '', hotelRecommendations, toolResults);

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    return {
      reply: this.fallbackReply(airports, hotelRecommendations),
      airports,
      hotelRecommendations,
      toolResults,
    };
  }

  private async createOpenAiCompletion(
    apiKey: string,
    model: string,
    messages: OpenAiMessage[],
    includeTools: boolean,
  ): Promise<OpenAiChatCompletion> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        tools: includeTools ? [this.searchAirportsToolDefinition, this.recommendHotelsToolDefinition] : undefined,
        tool_choice: includeTools ? 'auto' : undefined,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      this.logger.error(`OpenAI 500 — model: ${model}, tools: ${includeTools}, schema: ${JSON.stringify(this.recommendHotelsJsonSchema)}`);
      throw new Error(`OpenAI request failed with status ${response.status}: ${responseText}`);
    }

    return JSON.parse(responseText) as OpenAiChatCompletion;
  }

  private get searchAirportsToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'search_airports',
        description: 'Search nearby or matching airports for a city, place, or airport name.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'City, place, or airport name to search for. Example: Berlin',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    };
  }

  private get recommendHotelsToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'recommend_hotels',
        description:
          'Create an actionable hotel search URL from traveller needs, destination, dates, rooms, and hotel preferences. Returns a URL, not hotel cards. If the user says baby, use child age 0 unless they give an age.',
        parameters: this.recommendHotelsJsonSchema,
      },
    };
  }

  private get anthropicSearchAirportsToolDefinition() {
    return {
      name: 'search_airports',
      description: 'Search nearby or matching airports for a city, place, or airport name.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'City, place, or airport name to search for. Example: Berlin',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    };
  }

  private get anthropicRecommendHotelsToolDefinition() {
    return {
      name: 'recommend_hotels',
      description:
        'Create an actionable hotel search URL from traveller needs, destination, dates, rooms, and hotel preferences. Returns a URL, not hotel cards. If the user says baby, use child age 0 unless they give an age.',
      input_schema: this.recommendHotelsJsonSchema,
    };
  }

  private get recommendHotelsJsonSchema() {
    return {
      type: 'object',
      properties: {
        destinationQuery: {
          type: 'string',
          description: 'Destination the user mentioned, e.g. "Ägypten", "Tunesien", "Mallorca".',
        },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        durationNights: { type: 'number' },
        rooms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              adults: { type: 'number' },
              childAges: {
                type: 'array',
                items: { type: 'number' },
              },
            },
            required: ['adults'],
          },
        },
        maxPriceEur: {
          type: 'number',
          description: 'Maximum nightly budget in EUR for all rooms combined (total per night, NOT per room or per person). The service multiplies this by durationNights to get the total trip price sent to the IBE. Convert from user\'s currency to EUR if needed (e.g. 150 USD ≈ 138 EUR). If the user says "per day" or "pro Tag", treat it as the nightly budget.',
        },
        beachfront: { type: 'boolean' },
        nearBeach: { type: 'boolean' },
        pool: { type: 'boolean' },
        familyFriendly: { type: 'boolean' },
        babyCot: { type: 'boolean' },
        quietHotel: { type: 'boolean' },
        minStars: { type: 'number' },
        minRecommendationRate: { type: 'number' },
        boardTypes: {
          type: 'array',
          items: { type: 'string' },
        },
        roomTypes: {
          type: 'array',
          items: { type: 'string' },
        },
        seaView: { type: 'boolean' },
      },
      required: ['rooms'],
    };
  }

  private async createAnthropicMessage(
    apiKey: string,
    model: string,
    messages: AnthropicMessage[],
    includeTools: boolean,
  ): Promise<AnthropicMessageResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: this.systemPrompt,
        messages,
        tools: includeTools
          ? [this.anthropicSearchAirportsToolDefinition, this.anthropicRecommendHotelsToolDefinition]
          : undefined,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}: ${responseText}`);
    }

    return JSON.parse(responseText) as AnthropicMessageResponse;
  }

  private airportSearchResponse(
    query: string,
    airports: AirportSearchResult[],
    toolResults: ChatToolResult[],
  ): ChatResponse {
    if (!airports.length) {
      return {
        reply: `I searched for nearby airports for "${query}", but I did not find any matches.`,
        airports,
        hotelRecommendations: [],
        toolResults,
      };
    }

    return {
      reply: this.fallbackAirportReply(airports),
      airports,
      hotelRecommendations: [],
      toolResults,
    };
  }

  private async callSearchAirportsTool(
    input: Record<string, unknown>,
    fallbackQuery: string,
    airports: AirportSearchResult[],
    toolResults: ChatToolResult[],
  ): Promise<AirportSearchResult[]> {
    const query = typeof input.query === 'string' ? input.query : fallbackQuery;
    const result = await this.airportMcpToolsService.searchAirports(query);

    airports.push(...result);
    toolResults.push({
      toolName: 'search_airports',
      input: { query },
      output: result,
    });

    return result;
  }

  private async callRecommendHotelsTool(
    input: Record<string, unknown>,
    fallbackMessage: string,
    hotelRecommendations: RecommendHotelsResult[],
    toolResults: ChatToolResult[],
  ): Promise<RecommendHotelsResult> {
    this.logger.log(`recommend_hotels raw input from AI: ${JSON.stringify(input)}`);
    const recommendHotelsInput = this.normalizeRecommendHotelsInput(input, fallbackMessage);
    const result = await this.hotelRecommendationService.recommendHotels(recommendHotelsInput);

    hotelRecommendations.push(result);
    toolResults.push({
      toolName: 'recommend_hotels',
      input: recommendHotelsInput as unknown as Record<string, unknown>,
      output: result,
    });

    return result;
  }

  private fallbackAirportReply(airports: AirportSearchResult[]): string {
    const names = airports.map((airport) => `${airport.name} (${airport.code})`).join(', ');
    return `Nearby airport options: ${names}.`;
  }

  private fallbackReply(airports: AirportSearchResult[], hotelRecommendations: RecommendHotelsResult[]): string {
    if (hotelRecommendations.length) {
      return 'I prepared a hotel search link with the matching filters I could infer.';
    }

    return this.fallbackAirportReply(airports);
  }

  private normalizeMessages(request: ChatRequest): ChatMessage[] {
    if (request.messages?.length) {
      return request.messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
    }

    return request.message ? [{ role: 'user', content: request.message }] : [];
  }

  private toOpenAiMessages(messages: ChatMessage[]): OpenAiMessage[] {
    return [
      {
        role: 'system',
        content: this.systemPrompt,
      },
      ...messages.map((message): OpenAiMessage => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }

  private toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
    const safeMessages = messages.filter((message) => message.role === 'user' || message.role === 'assistant');

    if (safeMessages[0]?.role === 'assistant') {
      safeMessages.unshift({
        role: 'user',
        content: 'Continue the travel assistant conversation.',
      });
    }

    return safeMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private getAnthropicToolUseBlocks(response: AnthropicMessageResponse): AnthropicToolUseBlock[] {
    return (response.content ?? []).filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use');
  }

  private getAnthropicText(response: AnthropicMessageResponse): string {
    return (response.content ?? [])
      .filter((block): block is AnthropicTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }

  private parseToolInput(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value) as unknown;
      return this.isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractAirportQuery(message: string): string {
    const query = message
      .replace(/^(find|show|get|search|tell me)\s+/i, '')
      .replace(/\b(airports?|near|nearby|around|closest|from|to|in|for|which|is|are|the)\b/gi, ' ')
      .replace(/[?!.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return query || message;
  }

  private shouldSearchAirports(message: string, query: string): boolean {
    if (/^(hi|hello|hey|hi there|hello there|good morning|good afternoon|good evening)$/i.test(message.trim())) {
      return false;
    }

    const mentionsAirport = /\b(airport|airports|fly|flight|near|nearby|from)\b/i.test(message);
    const looksLikeCity = query.length > 1 && query.length <= 80 && !/\b(hotel|beach|pool|package)\b/i.test(message);

    return mentionsAirport || looksLikeCity;
  }

  private shouldRecommendHotels(message: string): boolean {
    return /\b(hotel|beach|beachfront|pool|baby|family|quiet|room|rooms|all inclusive|breakfast)\b/i.test(message);
  }

  private recommendHotelsInputFromMessage(message: string): RecommendHotelsInput {
    return {
      destinationQuery: this.extractDestinationQuery(message),
      rooms: [
        {
          adults: /\bcouple\b/i.test(message) ? 2 : 2,
          childAges: /\b(baby|infant)\b/i.test(message) ? [0] : [],
        },
      ],
      beachfront: /\bbeachfront\b/i.test(message),
      nearBeach: /\bbeach\b/i.test(message),
      pool: /\bpool\b/i.test(message),
      familyFriendly: /\b(family|baby|child|children|kid|kids)\b/i.test(message),
      babyCot: /\b(baby|cot|infant)\b/i.test(message),
      quietHotel: /\bquiet\b/i.test(message),
      minStars: this.extractMinStars(message),
    };
  }

  private normalizeRecommendHotelsInput(input: Record<string, unknown>, fallbackMessage: string): RecommendHotelsInput {
    const fallback = this.recommendHotelsInputFromMessage(fallbackMessage);

    return {
      destinationQuery: this.optionalString(input.destinationQuery) ?? fallback.destinationQuery,
      startDate: this.optionalString(input.startDate),
      endDate: this.optionalString(input.endDate),
      durationNights: typeof input.durationNights === 'number' ? input.durationNights : undefined,
      rooms: this.normalizeRooms(input.rooms) ?? fallback.rooms,
      maxPriceEur: typeof input.maxPriceEur === 'number' ? input.maxPriceEur : undefined,
      beachfront: this.optionalBoolean(input.beachfront) ?? fallback.beachfront,
      nearBeach: this.optionalBoolean(input.nearBeach) ?? fallback.nearBeach,
      pool: this.optionalBoolean(input.pool) ?? fallback.pool,
      familyFriendly: this.optionalBoolean(input.familyFriendly) ?? fallback.familyFriendly,
      babyCot: this.optionalBoolean(input.babyCot) ?? fallback.babyCot,
      quietHotel: this.optionalBoolean(input.quietHotel) ?? fallback.quietHotel,
      minStars: this.normalizeStars(input.minStars) ?? fallback.minStars,
      minRecommendationRate: this.normalizeRecommendationRate(input.minRecommendationRate),
      boardTypes: this.boardTypeArray(input.boardTypes),
      roomTypes: this.roomTypeArray(input.roomTypes),
      seaView: this.optionalBoolean(input.seaView),
    };
  }

  private extractDestinationQuery(message: string): string | undefined {
    const match = message.match(/\b(?:in|to|for)\s+([A-Z][A-Za-zÀ-ÿ\s-]{2,})/);
    return match?.[1]?.trim();
  }

  private extractMinStars(message: string): 1 | 2 | 3 | 4 | 5 | undefined {
    const match = message.match(/\b([1-5])\s*(?:star|stars|\*)/i);
    return this.normalizeStars(match ? Number(match[1]) : undefined);
  }

  private normalizeRooms(value: unknown): RecommendHotelsInput['rooms'] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const rooms = value
      .filter(this.isRecord)
      .map((room) => ({
        adults: typeof room.adults === 'number' ? room.adults : 2,
        childAges: this.numberArray(room.childAges),
      }));

    return rooms.length ? rooms : undefined;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private optionalBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  private normalizeStars(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
    return typeof value === 'number' && value >= 1 && value <= 5 ? (value as 1 | 2 | 3 | 4 | 5) : undefined;
  }

  private normalizeRecommendationRate(value: unknown): 80 | 90 | 100 | undefined {
    return value === 80 || value === 90 || value === 100 ? value : undefined;
  }

  private stringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
  }

  private boardTypeArray(value: unknown): AmadeusBoardType[] | undefined {
    const items = this.stringArray(value)?.filter((item): item is AmadeusBoardType =>
      AMADEUS_BOARD_TYPES.has(item as AmadeusBoardType),
    );

    return items?.length ? items : undefined;
  }

  private roomTypeArray(value: unknown): AmadeusRoomType[] | undefined {
    const items = this.stringArray(value)?.filter((item): item is AmadeusRoomType =>
      AMADEUS_ROOM_TYPES.has(item as AmadeusRoomType),
    );

    return items?.length ? items : undefined;
  }

  private numberArray(value: unknown): number[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : undefined;
  }

  private get aiProvider(): AiProvider {
    return this.configService.get<AiProvider>('AI_PROVIDER') ?? 'local';
  }

  private get providerModel(): string | null {
    if (this.aiProvider === 'openai') {
      return this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
    }

    if (this.aiProvider === 'anthropic') {
      return this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
    }

    return null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error.';
  }
}
