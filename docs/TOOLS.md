# Tool reference

All twelve tools exposed by the server, with their inputs. Defaults are shown in `(parentheses)`.
Inputs are validated with [Zod](https://zod.dev); each tool returns a trimmed, agent-friendly JSON
summary of the Duffel response (not the raw payload).

Conventions:
- Dates are `YYYY-MM-DD`. Phone numbers are E.164 (e.g. `+442080160509`).
- IDs flow forward between calls — each step returns the ID the next step needs.

---

## Flights

### `search_flights`
Search bookable offers across one or more legs.

| Input | Type | Notes |
|---|---|---|
| `slices` | array (1–6) | Each: `{ origin, destination, departure_date }` (IATA codes). One slice = one-way, two = round-trip. |
| `adults` | int 1–9 | *(1)* |
| `children_ages` | int[] | Age of each child (0–17) at travel time. Optional. |
| `cabin_class` | enum | `economy` \| `premium_economy` \| `business` \| `first` *(economy)* |
| `max_results` | int 1–50 | *(10)* |

Returns offers with `offer_id`, price, airline, and timing. → feed an `offer_id` to `get_offer`.

### `get_offer`
Fetch full detail for one offer. **Prices are only guaranteed at the time of this call**, so call it before booking.

| Input | Type | Notes |
|---|---|---|
| `offer_id` | string | From `search_flights`. |
| `include_available_services` | bool | Include add-on bags/seats *(false)* |

Returns fare conditions, baggage, passenger IDs. → use the passenger IDs in `create_order`.

### `create_order`
Book an offer.

| Input | Type | Notes |
|---|---|---|
| `offer_id` | string | |
| `passengers` | array (≥1) | Each: `given_name, family_name, born_on, email, phone_number, gender (m\|f), title (mr\|ms\|mrs\|miss\|dr)` |
| `payment_type` | enum | `balance` \| `arranged_external_to_duffel` *(balance)* — `balance` is sandbox-safe |
| `amount` | string | Defaults to the offer's `total_amount` |
| `currency` | string | Defaults to the offer's `total_currency` |

Returns the booking with its reference. → `get_order` to retrieve later.

### `get_order`
Retrieve a booking by `order_id`. Returns reference, status, passengers, and flight segments.

> **Note:** booking status is derived from the order's `payment_status`, **not** a `confirmed_at`
> field (Duffel's order resource has no such field). See [ARCHITECTURE.md](ARCHITECTURE.md#the-get_order-status-fix).

### `get_cancellation_quote`
Request a refund quote for an order — shows refund amount and penalty **without cancelling**.

| Input | Type |
|---|---|
| `order_id` | string |

Returns an `order_cancellation_id`. → pass it to `cancel_order` to actually cancel.

### `cancel_order`
Confirm and finalize a cancellation. Two-step by design — needs an `order_cancellation_id` from `get_cancellation_quote`.

| Input | Type |
|---|---|
| `order_cancellation_id` | string |

---

## Stays (accommodation)

### `search_stays`
Search accommodation near a coordinate. **`beach`, `resort`, etc. are not searchable filters** — search
by coordinates, then filter the returned results on rating/amenities.

| Input | Type | Notes |
|---|---|---|
| `latitude` | number −90–90 | Search centre |
| `longitude` | number −180–180 | Search centre |
| `radius_km` | int 1–100 | *(5)* |
| `check_in_date` | string | `YYYY-MM-DD` |
| `check_out_date` | string | `YYYY-MM-DD` |
| `adults` | int 1–9 | *(2)* |
| `children_ages` | int[] | Age of each child (0–17) at stay time. Optional. |
| `rooms` | int 1–9 | *(1)* |
| `max_results` | int 1–50 | *(10)* |

Returns results with `search_result_id`, cheapest rate, star rating, amenities. → `get_stays_rates`.

### `get_stays_rates`
List all rooms and rates for a search result. Rates differ by board type and refundability.

| Input | Type | Notes |
|---|---|---|
| `search_result_id` | string | From `search_stays`. |

Returns rooms, each with rates carrying `rate_id`, price, `board_type`, `refundable`, cancellation timeline. → `create_stays_quote`.

### `create_stays_quote`
Confirm a rate's price and availability before booking (rates can change or sell out between search and booking).

| Input | Type |
|---|---|
| `rate_id` | string |

Returns a `quote_id` (plus totals, taxes, `expires_at`). → `create_stays_booking`.

### `create_stays_booking`
Book a stay from a quote. In sandbox this is paid from your Duffel balance — **no payment object is sent**
(Duffel requires it to be omitted for balance payments; this differs from the Flights API).

| Input | Type | Notes |
|---|---|---|
| `quote_id` | string | |
| `guests` | array (≥1) | Each: `given_name, family_name, born_on?` (`born_on` required for children). One name per room ideally. |
| `email` | string | Lead guest email |
| `phone_number` | string | E.164 |
| `accommodation_special_requests` | string | Optional, non-sensitive |

Returns the booking with a `confirmed` status and reference.

### `get_stays_booking`
Retrieve a stay booking by `booking_id`. Returns status, reference, dates, accommodation, guests.

> Unlike flights, the stay booking exposes a real `status` enum (`confirmed` | `cancelled`) — no derivation needed.

### `cancel_stays_booking`
Cancel a confirmed booking. **One step** (the refund is already set by the rate's cancellation policy),
guarded by an explicit confirm flag.

| Input | Type | Notes |
|---|---|---|
| `booking_id` | string | |
| `confirm` | bool | **Must be `true`** to proceed — a deliberate guard against accidental cancellation *(false)* |

Returns final status, `cancelled_at`, and any refund amount.
