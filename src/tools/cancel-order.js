import { z } from "zod";

export const cancelOrderTool = {
  name: "cancel_order",
  description:
    "Confirm and finalize a booking cancellation. Requires an order_cancellation_id " +
    "from a prior get_cancellation_quote call — this is a deliberate two-step " +
    "process so a cancellation is never triggered by mistake.",
  inputSchema: {
    order_cancellation_id: z.string(),
  },
  async handler(client, args) {
    const cancellation = await client.confirmOrderCancellation({
      orderCancellationId: args.order_cancellation_id,
    });

    return {
      order_cancellation_id: cancellation.id,
      order_id: cancellation.order_id,
      confirmed_at: cancellation.confirmed_at,
      refund_amount: cancellation.refund_amount,
      refund_currency: cancellation.refund_currency,
      status: cancellation.confirmed_at ? "cancelled" : "pending",
    };
  },
};
