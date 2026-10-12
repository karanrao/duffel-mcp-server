import { z } from "zod";

export const getOfferTool = {
  name: "get_offer",
  description:
    "Fetch full details for a single offer returned by search_flights — fare conditions, " +
    "baggage allowance, and (optionally) available add-on services. Call this before " +
    "creating an order, since prices are only guaranteed at the time of this call.",
  inputSchema: {
    offer_id: z.string().describe("The offer_id from search_flights"),
    include_available_services: z
      .boolean()
      .default(false)
      .describe("Include extra bags/seats available to add at booking time"),
  },
  async handler(client, args) {
    const offer = await client.getOffer({
      offerId: args.offer_id,
      returnAvailableServices: args.include_available_services,
    });

    return {
      offer_id: offer.id,
      total_amount: offer.total_amount,
      total_currency: offer.total_currency,
      base_amount: offer.base_amount,
      tax_amount: offer.tax_amount,
      airline: offer.owner?.name,
      expires_at: offer.expires_at,
      passenger_identity_documents_required: offer.passenger_identity_documents_required,
      passengers: (offer.passengers || []).map((p) => ({
        id: p.id,
        type: p.type,
        age: p.age,
      })),
      slices: (offer.slices || []).map((slice) => ({
        origin: slice.origin?.iata_code,
        destination: slice.destination?.iata_code,
        duration: slice.duration,
        fare_brand: slice.fare_brand_name,
        conditions: slice.conditions,
        segments: (slice.segments || []).map((seg) => ({
          marketing_carrier: seg.marketing_carrier?.iata_code,
          flight_number: seg.marketing_carrier_flight_number,
          departing_at: seg.departing_at,
          arriving_at: seg.arriving_at,
          baggage: seg.passengers?.[0]?.baggages,
        })),
      })),
      conditions: offer.conditions,
      available_services: args.include_available_services
        ? offer.available_services
        : undefined,
    };
  },
};
