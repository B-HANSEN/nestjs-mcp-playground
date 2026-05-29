# nestjs-mcp-playground

A NestJS project with two independent entry points: a travel assistant **Chat API** and an **MCP server** for Claude Desktop. Both share the same domain services (airport search, hotel recommendations) backed by a GraphQL API.

## Architecture

```
src/
├── main.ts               # Chat API entry point (port 3000)
├── mcp-main.ts           # MCP HTTP server entry point (port 3001)
├── mcp-stdio.ts          # MCP stdio entry point (for Claude Desktop)
├── mcp-entry/            # NestJS app context used by both MCP entry points
│   ├── mcp-app.module.ts
│   └── mcp-tools.service.ts   # Registers search_airports + recommend_hotels as MCP tools
└── modules/
    ├── airport/          # AirportService — searches airports via GraphQL
    ├── hotel/            # HotelRecommendationService — builds Amadeus hotel search URLs
    ├── chat/             # ChatService — travel assistant with OpenAI / Anthropic / local backends
    ├── graphql-client/   # Shared GraphQL HTTP client
    └── tool-registry/    # Registers shared tools on chat app startup
```

## Chat API (port 3000)

A travel assistant accessible via browser or REST. Supports three backends configured via `AI_PROVIDER`:

- **`local`** (default) — rule-based keyword matching, no LLM required
- **`openai`** — GPT with function calling (`search_airports`, `recommend_hotels`)
- **`anthropic`** — Claude with tool use (`search_airports`, `recommend_hotels`)

The chat layer calls the same domain services as the MCP server. No raw GraphQL is exposed to the browser or model.

Endpoints:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/chat` | Main travel assistant chat |
| `POST` | `/api/airport-chat` | Airport-only chat endpoint |
| `GET` | `/health` | Health check |

## MCP Server (port 3001 / stdio)

Implements the [Model Context Protocol](https://modelcontextprotocol.io) so Claude Desktop can call travel tools directly.

Endpoints:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/mcp` | Stateless MCP tool call (StreamableHTTP) |

For Claude Desktop, use the stdio entry point (`mcp-stdio.ts`) via `npm run start:mcp:stdio`.

## Tools

Both the Chat API and MCP server expose the same tools:

| Tool | Description | Backend |
| --- | --- | --- |
| `search_airports` | Find departure airports for a city or place | `AirportService` → GraphQL |
| `recommend_hotels` | Build a hotel search URL from traveller needs | `HotelRecommendationService` → Amadeus IBE URL |

`recommend_hotels` returns a search URL, not hotel cards. The GraphQL backend does not return hotel inventory.

## Local development

```bash
npm install
cp .env.example .env
# fill in GRAPHQL_API_URL and optionally AI_PROVIDER + API keys
npm run start:dev        # Chat API on :3000
npm run start:mcp:dev    # MCP HTTP server on :3001
```

Open the chat UI at `http://localhost:3000`.

## Environment variables

| Variable | Description |
| --- | --- |
| `API_KEY` | Required in `x-api-key` header for all API requests. Leave unset to disable auth (local dev). |
| `GRAPHQL_API_URL` | GraphQL API URL (required) |
| `GRAPHQL_API_TOKEN` | Bearer token for authenticated GraphQL APIs |
| `GRAPHQL_BRAND_ID` | Optional `x-brand-id` header |
| `GRAPHQL_LOCALE` | Optional `x-locale` header, e.g. `de`, `at`, `ch` |
| `GRAPHQL_AIRPORT_SEARCH_QUERY` | Override the airport search query. Must accept a `$query: String!` variable. |
| `AI_PROVIDER` | `local` (default), `openai`, or `anthropic` |
| `OPENAI_API_KEY` | Required when `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | OpenAI model name. Defaults to `gpt-4.1-mini` |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic` |
| `ANTHROPIC_MODEL` | Claude model name. Defaults to `claude-sonnet-4-6` |
