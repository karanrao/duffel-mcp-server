# Architecture & design notes

## Shape

A thin MCP server over the Duffel REST API. Three layers:

```
src/index.js         Registers the 12 tools, speaks MCP over stdio
src/tools/*.js       One tool each: a Zod inputSchema + a handler that calls the client
                     and returns a trimmed, agent-friendly summary
src/duffel-client.js One place for auth, the request envelope, and error surfacing
```

Each tool is a plain object `{ name, description, inputSchema, handler }`. Adding a tool is: write the
file, import it, push it onto the `TOOLS` array. No framework beyond the MCP SDK and Zod.

### The client
`duffel-client.js` centralises three things every call needs:
- **Auth & version headers** — bearer token from `DUFFEL_ACCESS_TOKEN`, Duffel API version.
- **The request envelope** — Duffel wraps request bodies in `{ "data": ... }` and returns results under
  `data`. The client does this once so tools deal in plain objects.
- **Error surfacing** — a non-2xx response becomes a `DuffelApiError` carrying Duffel's own status and
  message, so the agent sees *why* a call failed (a `422` validation message, a `403` entitlement
  message) rather than a generic failure.

### Tool outputs are summaries, not raw payloads
Duffel responses are large. Each handler returns a compact projection — the IDs and fields the next
step needs — which keeps agent context lean and the tool contract stable even if Duffel adds fields.

---

## Deliberate choices

### Two-step flight cancellation
Flights cancel in two calls: `get_cancellation_quote` (shows the refund, changes nothing) then
`cancel_order` (acts on a specific `order_cancellation_id`). A cancellation can therefore never fire
from a single tool call — an agent has to see the refund terms first, then explicitly confirm.

### One-step stay cancellation, with a guard
Duffel's Stays API cancels in one call (the refund is already fixed by the rate's cancellation policy
at booking time, so there's nothing to quote). To keep the same "never cancel by accident" property,
`cancel_stays_booking` requires an explicit `confirm: true`; without it the tool refuses and explains.
Same safety intent, matched to each API's real shape.

### Sandbox-safe payment defaults
`create_order` defaults to `payment_type: "balance"` (drawn from the Duffel sandbox balance).
`create_stays_booking` sends **no** payment object at all — Duffel requires it to be *omitted* for
balance payments, which is the opposite of the Flights API and an easy thing to get wrong.

---

## Two bugs worth recording

These are the kind of quirk that costs an afternoon; both are fixed in the code and called out here so
they aren't reintroduced.

### The `get_order` status fix
Duffel's **order** resource has no `confirmed_at` field. An early version derived booking status from
it, so every live (non-cancelled) order reported as `pending`, even when fully paid. Status is instead
derived from the `payment_status` object (`awaiting_payment` / `paid_at`). *(The **stay** booking, by
contrast, does expose a real `status` enum — so `get_stays_booking` reads it directly.)*

### The Windows `process.exit` crash
Calling `process.exit(1)` on failure raced Node's `fetch` (undici) socket teardown on Windows and
tripped a libuv assertion (`UV_HANDLE_CLOSING`). The smoke tests now set `process.exitCode = 1` and let
the event loop drain, which exits cleanly with the right code.

---

## Roadmap: from tools to a holiday agent

The tools above are intentionally **atomic** — one Duffel action each. The product direction
([agenticdirect.io](https://agenticdirect.io)) is a **destination-attach agent**: take a flight
itinerary and orchestrate hotels (and later transfers and activities) conversationally. That
orchestration sits *above* these tools, and splits cleanly by risk:

**Search — the agent orchestrates.** A request like *"find me a holiday for a family of 4 at a beach
resort"* supplies none of the parameters the APIs need (no origin, no destination, no dates) and
`beach`/`resort` aren't searchable filters. Turning intent into concrete searches is world-knowledge
work the model does well:
1. **Elicit** the non-inferable bits — origin, a date window, budget, and the children's ages (needed
   for both flight pricing and the stays guest list).
2. **Generate candidate destinations** — real, reachable family-beach spots. No Duffel endpoint does
   this; it's the agent's value-add.
3. **Fan out** per candidate: resolve each to an airport (flights) and a beachfront coordinate (stays),
   then call search for both.
4. **Filter & rank** the returned results on beach/resort/family fit (rating, amenities, room capacity)
   and total price.

**Booking — the server orchestrates.** Booking a flight *and* a hotel is a distributed transaction
across two independent `create` calls that can fail independently. A composite `book_holiday` tool
would: re-quote both to confirm price/availability, book sequentially, and **compensate on partial
failure** (if the hotel fails after the flight books, cancel the flight — which the two-step flight
cancel already supports). This is a saga, and it's the one part you don't let an agent improvise.

So the natural next tools are a read-only `search_holiday` (safe to build and test without live
booking) and, after it's solid, a transactional `book_holiday` with rollback.
