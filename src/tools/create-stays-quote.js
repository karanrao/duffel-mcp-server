import { z } from "zod";

export const createStaysQuoteTool = {
  name: "create_stays_quote",
  description:
    "Request a final quote for a selected rate (from get_stays_rates), confirming the " +
    "rate is still available and priced before booking. Returns a quote_id to pass to " +
    "create_stays_booking. Occasionally a rate becomes unavailable or repriced between " +
    "search and quote — this step surfaces that.",
  inputSchema: {
    rate_id: z.string().describe("The rate_id from get_stays_rates"),
  },
  async handler(client, args) {
    const quote = await client.createStayQuote({ rateId: args.rate_id });

    const acc = quote.accommodation || {};

    return {
      quote_id: quote.id,
      total_amount: quote.total_amount,
      total_currency: quote.total_currency,
      base_amount: quote.base_amount,
      tax_amount: quote.tax_amount,
      due_at_accommodation_amount: quote.due_at_accommodation_amount,
      due_at_accommodation_currency: quote.due_at_accommodation_currency,
      expires_at: quote.expires_at,
      supported_loyalty_programme: quote.supported_loyalty_programme,
      accommodation: {
        id: acc.id,
        name: acc.name,
        check_in_date: quote.check_in_date,
        check_out_date: quote.check_out_date,
      },
    };
  },
};
