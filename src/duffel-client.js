const DUFFEL_API_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

/**
 * Thrown when Duffel returns a non-2xx response. Carries the parsed
 * Duffel error body (title/message/type/code) so tools can surface it.
 */
export class DuffelApiError extends Error {
  constructor(status, body) {
    const firstError = body?.errors?.[0];
    const message =
      firstError?.message ||
      firstError?.title ||
      `Duffel API request failed with status ${status}`;
    super(message);
    this.name = "DuffelApiError";
    this.status = status;
    this.errors = body?.errors ?? [];
  }
}

/**
 * Thin wrapper around the Duffel Flights API.
 * Reads the access token from the DUFFEL_ACCESS_TOKEN environment
 * variable — never hardcode it, and never accept it as a tool argument.
 */
export class DuffelClient {
  constructor({ accessToken, baseUrl = DUFFEL_API_BASE } = {}) {
    this.accessToken = accessToken || process.env.DUFFEL_ACCESS_TOKEN;
    this.baseUrl = baseUrl;

    if (!this.accessToken) {
      throw new Error(
        "Missing Duffel access token. Set the DUFFEL_ACCESS_TOKEN environment variable " +
          "(get a test token from your Duffel dashboard's Access Tokens page)."
      );
    }
  }

  async _request(method, path, { body, query } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Duffel-Version": DUFFEL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify({ data: body }) : undefined,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON response — likely a network/proxy error rather than
      // a real Duffel API error. Surface the raw text for debugging.
      throw new Error(
        `Duffel request to ${path} returned a non-JSON response ` +
          `(status ${res.status}): ${text.slice(0, 200)}`
      );
    }

    if (!res.ok) {
      throw new DuffelApiError(res.status, json);
    }

    return json.data;
  }

  // ---- Offer requests / search ----

  createOfferRequest({ slices, passengers, cabinClass, returnOffers = true }) {
    return this._request("POST", "/air/offer_requests", {
      query: { return_offers: returnOffers },
      body: {
        slices,
        passengers,
        cabin_class: cabinClass,
      },
    });
  }

  listOffers({ offerRequestId, limit = 20, sort }) {
    return this._request("GET", "/air/offers", {
      query: {
        offer_request_id: offerRequestId,
        limit,
        sort,
      },
    });
  }

  getOffer({ offerId, returnAvailableServices = false }) {
    return this._request("GET", `/air/offers/${offerId}`, {
      query: { return_available_services: returnAvailableServices },
    });
  }

  // ---- Orders ----

  createOrder({ selectedOffers, passengers, payments, type = "instant" }) {
    return this._request("POST", "/air/orders", {
      body: {
        type,
        selected_offers: selectedOffers,
        passengers,
        payments,
      },
    });
  }

  getOrder({ orderId }) {
    return this._request("GET", `/air/orders/${orderId}`);
  }

  listOrders({ limit = 20, bookingReference } = {}) {
    return this._request("GET", "/air/orders", {
      query: { limit, booking_reference: bookingReference },
    });
  }

  // ---- Cancellations ----

  createOrderCancellation({ orderId }) {
    return this._request("POST", "/air/order_cancellations", {
      body: { order_id: orderId },
    });
  }

  confirmOrderCancellation({ orderCancellationId }) {
    return this._request(
      "POST",
      `/air/order_cancellations/${orderCancellationId}/actions/confirm`
    );
  }

  // ================= Stays (accommodation) =================

  // ---- Search & rates ----

  searchStays({ location, checkInDate, checkOutDate, guests, rooms = 1 }) {
    return this._request("POST", "/stays/search", {
      body: {
        rooms,
        location,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests,
      },
    });
  }

  // Rates are fetched per search result. This POST action takes no body.
  fetchAllRates({ searchResultId }) {
    return this._request(
      "POST",
      `/stays/search_results/${searchResultId}/actions/fetch_all_rates`
    );
  }

  // ---- Quotes & bookings ----

  createStayQuote({ rateId }) {
    return this._request("POST", "/stays/quotes", {
      body: { rate_id: rateId },
    });
  }

  createStayBooking({
    quoteId,
    guests,
    email,
    phoneNumber,
    specialRequests,
    loyaltyAccountNumber,
  }) {
    const body = {
      quote_id: quoteId,
      guests,
      email,
      phone_number: phoneNumber,
    };
    if (specialRequests) body.accommodation_special_requests = specialRequests;
    if (loyaltyAccountNumber)
      body.loyalty_programme_account_number = loyaltyAccountNumber;
    // NOTE: `payment` is intentionally omitted. For balance payments Duffel
    // requires the payment object to be absent (unlike the Flights API, which
    // takes an explicit payments array). Passing one here would 422.
    return this._request("POST", "/stays/bookings", { body });
  }

  getStayBooking({ bookingId }) {
    return this._request("GET", `/stays/bookings/${bookingId}`);
  }

  // One-step cancellation (no separate quote/confirm like flights). Takes no body.
  cancelStayBooking({ bookingId }) {
    return this._request(
      "POST",
      `/stays/bookings/${bookingId}/actions/cancel`
    );
  }
}
