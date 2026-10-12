#!/usr/bin/env node
/**
 * Stays smoke test: search_stays -> get_stays_rates -> create_stays_quote
 * -> create_stays_booking -> get_stays_booking -> cancel_stays_booking
 * against the real Duffel sandbox.
 *
 * Run with: DUFFEL_ACCESS_TOKEN=duffel_test_... node test/stays-smoke-test.js
 *
 * Uses Duffel's test-hotel coordinates (central London) so a result is
 * reliably returned in sandbox. Requires network access to api.duffel.com.
 */
import { DuffelClient } from "../src/duffel-client.js";
import { searchStaysTool } from "../src/tools/search-stays.js";
import { getStaysRatesTool } from "../src/tools/get-stays-rates.js";
import { createStaysQuoteTool } from "../src/tools/create-stays-quote.js";
import { createStaysBookingTool } from "../src/tools/create-stays-booking.js";
import { getStaysBookingTool } from "../src/tools/get-stays-booking.js";
import { cancelStaysBookingTool } from "../src/tools/cancel-stays-booking.js";

function log(step, data) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const client = new DuffelClient();

  // 1. Search — family of 4 (2 adults + 2 children), central London test hotel.
  const search = await searchStaysTool.handler(client, {
    latitude: 51.5071,
    longitude: -0.1416,
    radius_km: 5,
    check_in_date: "2026-09-15",
    check_out_date: "2026-09-18",
    adults: 2,
    children_ages: [8, 10],
    rooms: 1,
    max_results: 5,
  });
  log("search_stays", { result_count: search.result_count });

  if (search.result_count === 0) {
    throw new Error("No accommodation returned — cannot continue smoke test.");
  }

  const first = search.results[0];
  console.log(
    `Using result ${first.search_result_id} — ${first.accommodation.name} ` +
      `(cheapest ${first.cheapest_rate_total_amount} ${first.cheapest_rate_currency})`
  );

  // 2. Fetch all rooms & rates for that result.
  const rates = await getStaysRatesTool.handler(client, {
    search_result_id: first.search_result_id,
  });
  log("get_stays_rates", {
    accommodation: rates.accommodation.name,
    room_count: rates.rooms.length,
    first_room_rate_count: rates.rooms[0]?.rates.length,
  });

  const firstRate = rates.rooms?.[0]?.rates?.[0];
  if (!firstRate) {
    throw new Error("No rates returned for the chosen result.");
  }
  console.log(
    `Using rate ${firstRate.rate_id} — ${firstRate.name} ` +
      `(${firstRate.total_amount} ${firstRate.total_currency}, ` +
      `refundable=${firstRate.refundable})`
  );

  // 3. Quote the selected rate (confirms availability & price).
  const quote = await createStaysQuoteTool.handler(client, {
    rate_id: firstRate.rate_id,
  });
  log("create_stays_quote", quote);

  // 4. Book it (sandbox balance payment — no payment object, no real charge).
  const booking = await createStaysBookingTool.handler(client, {
    quote_id: quote.quote_id,
    guests: [
      { given_name: "Test", family_name: "Parent", born_on: "1985-04-12" },
      { given_name: "Sam", family_name: "Parent", born_on: "1987-08-03" },
      { given_name: "Alex", family_name: "Parent", born_on: "2018-02-20" },
      { given_name: "Robin", family_name: "Parent", born_on: "2016-06-11" },
    ],
    email: "test.parent@example.com",
    phone_number: "+442080160509",
    accommodation_special_requests: "Family room, cot if available",
  });
  log("create_stays_booking", booking);

  // 5. Fetch it back — status should be "confirmed".
  const fetched = await getStaysBookingTool.handler(client, {
    booking_id: booking.booking_id,
  });
  log("get_stays_booking", fetched);

  // 6. Cancel it (one-step; requires the explicit confirm guard).
  const cancelled = await cancelStaysBookingTool.handler(client, {
    booking_id: booking.booking_id,
    confirm: true,
  });
  log("cancel_stays_booking", cancelled);

  console.log(
    "\n✅ Stays smoke test completed: search → rates → quote → book → fetch → cancel"
  );
}

main().catch((err) => {
  console.error("\n❌ Stays smoke test failed:", err.message);
  // Set exitCode instead of process.exit(1): forcing exit here races undici's
  // socket teardown and trips a libuv assertion on Windows. Letting the event
  // loop drain naturally exits cleanly with code 1.
  process.exitCode = 1;
});
