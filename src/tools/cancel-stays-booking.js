import { z } from "zod";

export const cancelStaysBookingTool = {
  name: "cancel_stays_booking",
  description:
    "Cancel a confirmed stay booking. Unlike flight cancellations, Duffel's Stays API " +
    "is a single step — the refund you'll receive is already set by the rate's " +
    "cancellation policy at booking time. To guard against accidental cancellation, " +
    "you must explicitly pass confirm=true. This is irreversible.",
  inputSchema: {
    booking_id: z.string(),
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Must be true to proceed. A deliberate guard so a booking is never " +
          "cancelled by mistake."
      ),
  },
  async handler(client, args) {
    if (!args.confirm) {
      throw new Error(
        "Cancellation not confirmed. Re-call cancel_stays_booking with confirm=true " +
          "to finalize — this cannot be undone."
      );
    }

    const booking = await client.cancelStayBooking({
      bookingId: args.booking_id,
    });

    // The rate's cancellation_timeline defines the refund; surface the most
    // relevant (first) window's refund amount if present.
    const rate = booking.accommodation?.rooms?.[0]?.rates?.[0];
    const refund = rate?.cancellation_timeline?.[0];

    return {
      booking_id: booking.id,
      reference: booking.reference,
      status: booking.status,
      cancelled_at: booking.cancelled_at,
      refund_amount: refund?.refund_amount ?? null,
      refund_currency: refund?.currency ?? null,
    };
  },
};
