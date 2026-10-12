#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { DuffelClient, DuffelApiError } from "./duffel-client.js";
import { searchFlightsTool } from "./tools/search-flights.js";
import { getOfferTool } from "./tools/get-offer.js";
import { createOrderTool } from "./tools/create-order.js";
import { getOrderTool } from "./tools/get-order.js";
import { getCancellationQuoteTool } from "./tools/get-cancellation-quote.js";
import { cancelOrderTool } from "./tools/cancel-order.js";
import { searchStaysTool } from "./tools/search-stays.js";
import { getStaysRatesTool } from "./tools/get-stays-rates.js";
import { createStaysQuoteTool } from "./tools/create-stays-quote.js";
import { createStaysBookingTool } from "./tools/create-stays-booking.js";
import { getStaysBookingTool } from "./tools/get-stays-booking.js";
import { cancelStaysBookingTool } from "./tools/cancel-stays-booking.js";

const TOOLS = [
  // Flights
  searchFlightsTool,
  getOfferTool,
  createOrderTool,
  getOrderTool,
  getCancellationQuoteTool,
  cancelOrderTool,
  // Stays
  searchStaysTool,
  getStaysRatesTool,
  createStaysQuoteTool,
  createStaysBookingTool,
  getStaysBookingTool,
  cancelStaysBookingTool,
];

function buildServer() {
  const server = new McpServer({
    name: "agentic-direct-duffel",
    version: "0.1.0",
  });

  // Instantiate lazily on first tool call so a missing token produces a
  // clear tool-level error instead of crashing the server at startup.
  let client;
  function getClient() {
    if (!client) client = new DuffelClient();
    return client;
  }

  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
      try {
        const result = await tool.handler(getClient(), args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message =
          err instanceof DuffelApiError
            ? `Duffel API error (${err.status}): ${err.message}`
            : err.message || String(err);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  return server;
}

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Duffel MCP server:", err);
  process.exit(1);
});
