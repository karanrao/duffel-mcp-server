import { z } from "zod";

export const getStaysRatesTool = {
  name: "get_stays_rates",
  description:
    "Fetch all available rooms and rates for a search result from search_stays. " +
    "Each room can have several rates that differ by board type (e.g. room only vs " +
    "breakfast included) and refundability. Take the rate_id you want and pass it to " +
    "create_stays_quote. Rates are only guaranteed once quoted.",
  inputSchema: {
    search_result_id: z
      .string()
      .describe("The search_result_id from a search_stays result"),
  },
  async handler(client, args) {
    const result = await client.fetchAllRates({
      searchResultId: args.search_result_id,
    });

    const acc = result.accommodation || {};

    return {
      search_result_id: result.id,
      check_in_date: result.check_in_date,
      check_out_date: result.check_out_date,
      accommodation: {
        id: acc.id,
        name: acc.name,
        rating: acc.rating,
      },
      rooms: (acc.rooms || []).map((room) => ({
        name: room.name,
        beds: room.beds,
        rates: (room.rates || []).map(summarizeRate),
      })),
    };
  },
};

function summarizeRate(rate) {
  return {
    rate_id: rate.id,
    name: rate.name,
    total_amount: rate.total_amount,
    total_currency: rate.total_currency,
    board_type: rate.board_type,
    payment_type: rate.payment_type,
    // A non-empty cancellation_timeline means at least a partial refund window
    // exists; an empty list is fully non-refundable.
    refundable: Array.isArray(rate.cancellation_timeline)
      ? rate.cancellation_timeline.length > 0
      : null,
    cancellation_timeline: rate.cancellation_timeline,
    expires_at: rate.expires_at,
  };
}
