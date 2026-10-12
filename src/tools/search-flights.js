import { z } from "zod";

const sliceSchema = z.object({
  origin: z.string().length(3).describe("IATA airport/city code, e.g. LHR"),
  destination: z.string().length(3).describe("IATA airport/city code, e.g. JFK"),
  departure_date: z.string().describe("YYYY-MM-DD"),
});

export const searchFlightsTool = {
  name: "search_flights",
  description:
    "Search for flights between one or more origin/destination pairs on given dates. " +
    "Returns a list of bookable offers with price, airline, and timing. " +
    "For a round trip, pass two slices (outbound and return).",
  inputSchema: {
    slices: z
      .array(sliceSchema)
      .min(1)
      .max(6)
      .describe("Flight legs. One slice for one-way, two for round-trip."),
    adults: z.number().int().min(1).max(9).default(1),
    children_ages: z
      .array(z.number().int().min(0).max(17))
      .optional()
      .describe("Age of each child passenger (under 18) at time of travel."),
    cabin_class: z
      .enum(["economy", "premium_economy", "business", "first"])
      .default("economy"),
    max_results: z.number().int().min(1).max(50).default(10),
  },
  async handler(client, args) {
    const passengers = [
      ...Array.from({ length: args.adults }, () => ({ type: "adult" })),
      ...(args.children_ages || []).map((age) => ({ age })),
    ];

    const offerRequest = await client.createOfferRequest({
      slices: args.slices,
      passengers,
      cabinClass: args.cabin_class,
    });

    const offers = (offerRequest.offers || []).slice(0, args.max_results);

    return {
      offer_request_id: offerRequest.id,
      offer_count: offers.length,
      offers: offers.map(summarizeOffer),
    };
  },
};

function summarizeOffer(offer) {
  return {
    offer_id: offer.id,
    total_amount: offer.total_amount,
    total_currency: offer.total_currency,
    airline: offer.owner?.name,
    expires_at: offer.expires_at,
    slices: (offer.slices || []).map((slice) => ({
      origin: slice.origin?.iata_code,
      destination: slice.destination?.iata_code,
      duration: slice.duration,
      segments: (slice.segments || []).map((seg) => ({
        marketing_carrier: seg.marketing_carrier?.iata_code,
        flight_number: seg.marketing_carrier_flight_number,
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
        aircraft: seg.aircraft?.name,
      })),
    })),
  };
}
