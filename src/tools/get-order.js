import { z } from "zod";

export const getOrderTool = {
  name: "get_order",
  description:
    "Retrieve the current details of an existing order/booking by its order_id, " +
    "including booking reference, passengers, and flight segments.",
  inputSchema: {
    order_id: z.string(),
  },
  async handler(client, args) {
    const order = await client.getOrder({ orderId: args.order_id });

    return {
      order_id: order.id,
      booking_reference: order.booking_reference,
      // Duffel's order resource has no `confirmed_at` field. Confirmation is
      // derived from payment_status: a paid, non-cancelled order is confirmed.
      status:
        order.cancelled_at != null
          ? "cancelled"
          : order.payment_status?.awaiting_payment === false ||
            order.payment_status?.paid_at != null
          ? "confirmed"
          : "awaiting_payment",
      awaiting_payment: order.payment_status?.awaiting_payment ?? null,
      paid_at: order.payment_status?.paid_at ?? null,
      total_amount: order.total_amount,
      total_currency: order.total_currency,
      airline: order.owner?.name,
      created_at: order.created_at,
      passengers: (order.passengers || []).map((p) => ({
        id: p.id,
        given_name: p.given_name,
        family_name: p.family_name,
        email: p.email,
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
