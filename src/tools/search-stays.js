import { z } from "zod";

export const searchStaysTool = {
  name: "search_stays",
  description:
    "Search for accommodation near a geographic point for a given stay. Returns a " +
    "list of available properties with their cheapest rate, star rating, and " +
    "amenities. Use the search_result_id from a result with get_stays_rates to see " +
    "bookable room rates. Note: 'beach', 'resort', and similar are not searchable " +
    "filters — search by coordinates, then filter the returned results.",
  inputSchema: {
    latitude: z.number().min(-90).max(90).describe("Latitude of the search centre"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Longitude of the search centre"),
    radius_km: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(5)
      .describe("Search radius in kilometres from the coordinates"),
    check_in_date: z.string().describe("YYYY-MM-DD"),
    check_out_date: z.string().describe("YYYY-MM-DD"),
    adults: z.number().int().min(1).max(9).default(2),
    children_ages: z
      .array(z.number().int().min(0).max(17))
      .optional()
      .describe("Age of each child guest (under 18) at time of stay."),
    rooms: z.number().int().min(1).max(9).default(1),
    max_results: z.number().int().min(1).max(50).default(10),
  },
  async handler(client, args) {
    const guests = [
      ...Array.from({ length: args.adults }, () => ({ type: "adult" })),
      ...(args.children_ages || []).map((age) => ({ type: "child", age })),
    ];

    const search = await client.searchStays({
      location: {
        radius: args.radius_km,
        geographic_coordinates: {
          latitude: args.latitude,
          longitude: args.longitude,
        },
      },
      checkInDate: args.check_in_date,
      checkOutDate: args.check_out_date,
      guests,
      rooms: args.rooms,
    });

    const results = (search.results || []).slice(0, args.max_results);

    return {
      search_id: search.id,
      check_in_date: search.check_in_date,
      check_out_date: search.check_out_date,
      result_count: results.length,
      results: results.map(summarizeResult),
    };
  },
};

function summarizeResult(result) {
  const acc = result.accommodation || {};
  return {
    search_result_id: result.id,
    cheapest_rate_total_amount: result.cheapest_rate_total_amount,
    cheapest_rate_currency: result.cheapest_rate_currency,
    accommodation: {
      id: acc.id,
      name: acc.name,
      rating: acc.rating,
      review_score: acc.review_score,
      city: acc.location?.address?.city_name,
      country_code: acc.location?.address?.country_code,
      amenities: (acc.amenities || []).map((a) => a.type),
    },
  };
}
