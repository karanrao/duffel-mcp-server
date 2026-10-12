import { z } from "zod";

const guestSchema = z.object({
  given_name: z.string(),
  family_name: z.string(),
  born_on: z
    .string()
    .optional()
    .describe("YYYY-MM-DD. Required for child guests."),
});

export const createStaysBookingTool = {
  name: "create_stays_booking",
  description:
    "Book a stay from a quote_id (from create_stays_quote). Provide the lead guest's " +
    "email and phone plus one guest name per room. In sandbox this is paid from your " +
    "Duffel balance — no card is charged and no payment object is sent. Returns the " +
    "booking with a confirmed status and reference.",
  inputSchema: {
    quote_id: z.string().describe("The quote_id from create_stays_quote"),
    guests: z
      .array(guestSchema)
      .min(1)
      .describe(
        "Guests staying. Pass at least one; ideally one name per room booked."
      ),
    email: z.string().email().describe("Lead guest's email address"),
    phone_number: z
      .string()
      .describe("Lead guest's phone in E.164 format, e.g. +442080160509"),
    accommodation_special_requests: z
      .string()
      .optional()
      .describe("Optional request forwarded to the accommodation (non-sensitive)"),
  },
  async handler(client, args) {
    const booking = await client.createStayBooking({
      quoteId: args.quote_id,
      guests: args.guests,
      email: args.email,
      phoneNumber: args.phone_number,
      specialRequests: args.accommodation_special_requests,
    });

    const acc = booking.accommodation || {};
    const firstRate = acc.rooms?.[0]?.rates?.[0];

    return {
      booking_id: booking.id,
      reference: booking.reference,
      status: booking.status,
      confirmed_at: booking.confirmed_at,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      rooms: booking.rooms,
      total_amount: firstRate?.total_amount,
      total_currency: firstRate?.total_currency,
      accommodation: {
        id: acc.id,
        name: acc.name,
        city: acc.location?.address?.city_name,
      },
      key_collection: acc.key_collection?.instructions,
      guests: (booking.guests || []).map((g) => ({
        given_name: g.given_name,
        family_name: g.family_name,
      })),
    };
  },
};
