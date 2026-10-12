import { z } from "zod";

export const getCancellationQuoteTool = {
  name: "get_cancellation_quote",
  description:
    "Request a cancellation quote for an existing order — shows the refund amount " +
    "and any penalty, WITHOUT actually cancelling the booking. Use the returned " +
    "order_cancellation_id with cancel_order to confirm and finalize the cancellation.",
  inputSchema: {
    order_id: z.string(),
  },
  async handler(client, args) {
    const cancellation = await client.createOrderCancellation({
      orderId: args.order_id,
    });

    return {
      order_cancellation_id: cancellation.id,
      order_id: cancellation.order_id,
      refund_amount: cancellation.refund_amount,
      refund_currency: cancellation.refund_currency,
      expires_at: cancellation.expires_at,
      confirmed_at: cancellation.confirmed_at,
      note: cancellation.confirmed_at
        ? "This cancellation is already confirmed."
        : "Call cancel_order with this order_cancellation_id to confirm and finalize.",
    };
  },
};
