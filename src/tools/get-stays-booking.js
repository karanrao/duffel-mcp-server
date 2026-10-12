import { z } from "zod";

export const getStaysBookingTool = {
  name: "get_stays_booking",
  description:
    "Retrieve the current details of an existing stay booking by its booking_id, " +
    "including status, reference, dates, and accommodation.",
  inputSchema: {
    booking_id: z.string(),
  },
  async handler(client, args) {
    const booking = await client.getStayBooking({ bookingId: args.booking_id });

    const acc = booking.accommodation || {};

    return {
      booking_id: booking.id,
      reference: booking.reference,
      // Unlike the flights order resource, the stay booking exposes a real
      // `status` enum ("confirmed" | "cancelled"), so no derivation is needed.
      status: booking.status,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      rooms: booking.rooms,
      email: booking.email,
      accommodation: {
        id: acc.id,
        name: acc.name,
        rating: acc.rating,
        city: acc.location?.address?.city_name,
      },
      guests: (booking.guests || []).map((g) => ({
        given_name: g.given_name,
        family_name: g.family_name,
      })),
    };
  },
};
