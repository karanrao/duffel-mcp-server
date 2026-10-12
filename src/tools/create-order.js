import { z } from "zod";

const passengerInfoSchema = z.object({
  id: z.string().describe("Passenger id from the offer (e.g. pas_0000...)"),
  given_name: z.string(),
  family_name: z.string(),
  born_on: z.string().describe("YYYY-MM-DD"),
  email: z.string().email(),
  phone_number: z.string().describe("E.164 format, e.g. +14155552671"),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
});

export const createOrderTool = {
  name: "create_order",
  description:
    "Book a flight offer. Requires full passenger details matching the passenger IDs " +
    "from the offer (use get_offer first to see passenger ids). In sandbox mode, use " +
    "payment_type 'balance' — no real card is charged.",
  inputSchema: {
    offer_id: z.string(),
    passengers: z.array(passengerInfoSchema).min(1),
    payment_type: z
      .enum(["balance", "arranged_external_to_duffel"])
      .default("balance")
      .describe("'balance' draws from your Duffel account balance (sandbox-safe)."),
    amount: z
      .string()
      .optional()
      .describe("Payment amount; defaults to the offer's total_amount if omitted"),
    currency: z
      .string()
      .optional()
      .describe("Payment currency; defaults to the offer's total_currency if omitted"),
  },
  async handler(client, args) {
    // Fetch the offer fresh to confirm current price, per Duffel's guidance
    // that search prices aren't guaranteed at booking time.
    const offer = await client.getOffer({ offerId: args.offer_id });

    const payments = [
      {
        type: args.payment_type,
        amount: args.amount || offer.total_amount,
        currency: args.currency || offer.total_currency,
      },
    ];

    const order = await client.createOrder({
      selectedOffers: [args.offer_id],
      passengers: args.passengers,
      payments,
    });

    return {
      order_id: order.id,
      booking_reference: order.booking_reference,
      total_amount: order.total_amount,
      total_currency: order.total_currency,
      airline: order.owner?.name,
      created_at: order.created_at,
      passengers: (order.passengers || []).map((p) => ({
        id: p.id,
        given_name: p.given_name,
        family_name: p.family_name,
      })),
      slices: (order.slices || []).map((slice) => ({
        origin: slice.origin?.iata_code,
        destination: slice.destination?.iata_code,
        segments: (slice.segments || []).map((seg) => ({
          marketing_carrier: seg.marketing_carrier?.iata_code,
          flight_number: seg.marketing_carrier_flight_number,
          departing_at: seg.departing_at,
          arriving_at: seg.arriving_at,
        })),
      })),
    };
  },
};
