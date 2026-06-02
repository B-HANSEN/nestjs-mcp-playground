# nestjs-mcp-playground

A NestJS **MCP server** that exposes travel tools (airport search, hotel recommendations) to Claude Desktop via the [Model Context Protocol](https://modelcontextprotocol.io). Domain services are backed by a GraphQL API.

## Architecture

```
src/
├── mcp-main.ts           # MCP HTTP server entry point (port 3001)
├── mcp-stdio.ts          # MCP stdio entry point (for Claude Desktop)
├── mcp-entry/            # NestJS app context for MCP
│   ├── mcp-app.module.ts
│   └── mcp-tools.service.ts   # Registers search_airports + recommend_hotels as MCP tools
└── modules/
    ├── airport/          # AirportService — searches airports via GraphQL
    ├── hotel/            # HotelRecommendationService — builds Amadeus hotel search URLs
    └── graphql-client/   # Shared GraphQL HTTP client
```

## MCP Server (port 3001 / stdio)

Two entry points are available:

| Entry point | Command | Use case |
| --- | --- | --- |
| `mcp-stdio.ts` | `npm run start:mcp-stdio` | Claude Desktop (stdio transport) |
| `mcp-main.ts` | `npm run start:mcp` | HTTP stateless transport (port 3001) |

For the HTTP transport, each `POST /mcp` request gets a fresh server instance (stateless).

## Tools

| Tool | Description | Backend |
| --- | --- | --- |
| `search_airports` | Find departure airports for a city or place | `AirportService` → GraphQL |
| `recommend_hotels` | Build a hotel search URL from traveller needs | `HotelRecommendationService` → Amadeus IBE URL |

`recommend_hotels` returns a search URL, not hotel cards. The GraphQL backend does not return hotel inventory.

## Local development

```bash
npm install
cp .env.example .env
# fill in GRAPHQL_API_URL
npm run build
npm run start:mcp-stdio   # stdio (Claude Desktop)
npm run start:mcp         # HTTP on :3001
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GRAPHQL_API_URL` | yes | GraphQL API URL |
| `GRAPHQL_API_TOKEN` | no | Bearer token for authenticated GraphQL APIs |
| `GRAPHQL_BRAND_ID` | no | Optional `x-brand-id` header |
| `GRAPHQL_LOCALE` | no | Optional `x-locale` header, e.g. `de`, `at`, `ch` |
| `GRAPHQL_AIRPORT_SEARCH_QUERY` | no | Override the airport search query. Must accept a `$query: String!` variable. |
| `API_KEY` | no | Required in `x-api-key` header for HTTP transport requests. Leave unset to disable auth. |
