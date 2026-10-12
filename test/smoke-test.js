#!/usr/bin/env node
/**
 * Smoke test: exercises search -> get_offer -> create_order -> get_order
 * -> get_cancellation_quote -> cancel_order against the real Duffel sandbox.
 *
 * Run with: DUFFEL_ACCESS_TOKEN=duffel_test_... npm run test:smoke
 *
 * Requires network access to api.duffel.com (this environment's own
 * container may block it — run this on your own machine).
 */
import { DuffelClient } from "../src/duffel-client.js";
import { searchFlightsTool } from "../src/tools/search-flights.js";
import { getOfferTool } from "../src/tools/get-offer.js";
import { createOrderTool } from "../src/tools/create-order.js";
import { getOrderTool } from "../src/tools/get-order.js";
import { getCancellationQuoteTool } from "../src/tools/get-cancellation-quote.js";
import { cancelOrderTool } from "../src/tools/cancel-order.js";

function log(step, data) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const client = new DuffelClient();

  // 1. Search
  const search = await searchFlightsTool.handler(client, {
    slices: [{ origin: "LHR", destination: "JFK", departure_date: "2026-09-15" }],
    adults: 1,
    cabin_class: "economy",
    max_results: 5,
  });
  log("search_flights", { offer_count: search.offer_count });

  if (search.offer_count === 0) {
    throw new Error("No offers returned — cannot continue smoke test.");
  }

  const firstOffer = search.offers[0];
  console.log(`Using offer ${firstOffer.offer_id} (${firstOffer.total_amount} ${firstOffer.total_currency})`);

  // 2. Get full offer detail (also confirms current price/passenger ids)
  const offerDetail = await getOfferTool.handler(client, {
    offer_id: firstOffer.offer_id,
  });
  log("get_offer", { passengers: offerDetail.passengers });

  const passengerId = offerDetail.passengers[0].id;

  // 3. Book it (sandbox balance payment — no real charge)
  const order = await createOrderTool.handler(client, {
    offer_id: firstOffer.offer_id,
    passengers: [
      {
        id: passengerId,
        given_name: "Test",
        family_name: "Passenger",
        born_on: "1990-01-01",
        email: "test.passenger@example.com",
        phone_number: "+14155552671",
        gender: "m",
        title: "mr",
      },
    ],
    payment_type: "balance",
  });
  log("create_order", order);

  // 4. Fetch it back
  const fetched = await getOrderTool.handler(client, { order_id: order.order_id });
  log("get_order", fetched);

  // 5. Get a cancellation quote (does not cancel yet)
  const quote = await getCancellationQuoteTool.handler(client, {
    order_id: order.order_id,
  });
  log("get_cancellation_quote", quote);

  // 6. Confirm the cancellation
  const cancelled = await cancelOrderTool.handler(client, {
    order_cancellation_id: quote.order_cancellation_id,
  });
  log("cancel_order", cancelled);

  console.log("\n✅ Smoke test completed: search → offer → book → fetch → quote → cancel");
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:", err.message);
  // See stays-smoke-test.js: avoid process.exit() here to prevent a libuv
  // teardown assertion on Windows; let the loop drain and exit with code 1.
  process.exitCode = 1;
});
