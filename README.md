# duffel-mcp-server

An [MCP](https://modelcontextprotocol.io) server that wraps the [Duffel](https://duffel.com) travel APIs,
giving an AI agent tools to **search, book, retrieve, and cancel flights and accommodation**
through natural conversation.

Part of **[agenticdirect.io](https://agenticdirect.io)** — a set of proof-of-concept tools exploring
agentic travel booking. This is a POC, not production software (see [Status](#status)).

---

## Status

| Area | State |
|---|---|
| **Flights** | ✅ Working end-to-end against the Duffel **sandbox** (search → book → cancel validated live) |
| **Stays (hotels)** | ⚙️ Built and validated against Duffel's documented API shapes; **blocked on Duffel enabling Stays** on the account (the sandbox token returns `403: feature not enabled` until access is granted) |
| **Production** | ❌ Not production-ready. Sandbox/test tokens only. No real payment integration. |

---

## Tools

Twelve tools, in two families that mirror each other (search → confirm → book → manage).

### Flights

| Tool | What it does |
|---|---|
| `search_flights` | Search bookable offers across one or more origin/destination legs |
| `get_offer` | Fetch full detail (fare rules, baggage, confirmed price) for one offer |
| `create_order` | Book a selected offer with passenger details |
| `get_order` | Retrieve an existing booking |
| `get_cancellation_quote` | Get a refund quote for a booking — **does not** cancel |
| `cancel_order` | Confirm and finalize a previously-quoted cancellation |

### Stays (accommodation)

| Tool | What it does |
|---|---|
| `search_stays` | Search accommodation near a coordinate for given dates and guests |
| `get_stays_rates` | List bookable rooms and rates for a search result |
| `create_stays_quote` | Confirm a rate's price and availability before booking |
| `create_stays_booking` | Book a stay from a quote |
| `get_stays_booking` | Retrieve an existing stay booking |
| `cancel_stays_booking` | Cancel a booking (one step; requires `confirm: true`) |

Full input/output reference: **[docs/TOOLS.md](docs/TOOLS.md)**.

---

## The two canonical flows

**Flights** — the cancellation is deliberately two steps so it can never fire from a single call:

```
search_flights → get_offer → create_order → get_order
                                           ↘ get_cancellation_quote → cancel_order
```

**Stays** — cancellation is one step (the refund is already fixed by the rate at booking time),
guarded by an explicit `confirm` flag:

```
search_stays → get_stays_rates → create_stays_quote → create_stays_booking → get_stays_booking
                                                                            ↘ cancel_stays_booking (confirm=true)
```

---

## Quick start

```bash
npm install
cp .env.example .env          # then paste your duffel_test_ token
npm run test:smoke            # flights: search → book → cancel against the sandbox
```

Get a token from the Duffel dashboard → **Developers → Access Tokens**. Use a `duffel_test_...`
token: it hits Duffel's sandbox, so nothing is charged and no real seats or rooms are touched.

Running the server directly:

```bash
npm start                     # starts the MCP server on stdio and waits for a client
```

A healthy stdio server prints nothing and waits — that silence is success.

> **Windows, corporate networks, and the MSIX Claude Desktop build** each have gotchas
> (PowerShell script policy, the real config-file location, TLS inspection). If anything
> fails to start or connect, see **[docs/SETUP.md](docs/SETUP.md)** — it covers them.

---

## Connecting to Claude Desktop

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "duffel": {
      "command": "node",
      "args": ["/absolute/path/to/duffel-mcp-server/src/index.js"],
      "env": {
        "DUFFEL_ACCESS_TOKEN": "duffel_test_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Use an **absolute** path to `src/index.js`. Fully quit and reopen Claude Desktop, then find the
server under the **"+" → Connectors** menu (or check **Settings → Developer** for its status).
Then try:

> "Find me a flight from LHR to JFK on 15 September 2026 for one adult."

Full setup, including the Windows/MSIX/corporate-proxy specifics, is in **[docs/SETUP.md](docs/SETUP.md)**.

---

## Testing a tool in isolation

Before wiring into an agent, call any tool directly with the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node src/index.js
```

---

## Getting Stays access

Unlike Flights, **Duffel Stays is not self-serve** — it must be enabled on your account by Duffel.
Until it is, every `search_stays` call returns `403: This feature is not enabled for your account`.
Request it from the Duffel dashboard (**More → Developers**) or via
[duffel.com/contact-us](https://duffel.com/contact-us). The Stays tools are built and validated
against Duffel's documented shapes, so they should pass their smoke test the moment access lands:

```bash
node test/stays-smoke-test.js
```

---

## Project structure

```
src/
  index.js              MCP server entrypoint — registers all 12 tools
  duffel-client.js      Thin Duffel API client (auth, request envelope, error surfacing)
  tools/                One file per tool (flights + stays)
test/
  smoke-test.js         Flights: end-to-end against the live Duffel sandbox
  stays-smoke-test.js   Stays: same loop (needs Stays access enabled)
docs/
  TOOLS.md              Full tool reference
  SETUP.md              Install + Windows/MSIX/corporate-proxy gotchas
  ARCHITECTURE.md       Design, deliberate choices, and the orchestration roadmap
```

---

## Known limitations

- **Sandbox only.** Test tokens (`duffel_test_...`) against Duffel's sandbox. No production payment path.
- **`create_order` pays by balance** (`payment_type: "balance"`), drawn from your Duffel sandbox balance. Production would need a real payment integration (e.g. Duffel Payments) — out of scope here.
- **Stays is gated** on Duffel enabling it (see above).
- **No seat maps / baggage add-ons / multi-currency** — natural next tools, not yet built.
- **Not hardened.** `npm audit` will flag advisories in the dependency tree; this is a POC, so do a proper dependency and secrets pass before any production use.

---

## Licence

[MIT](LICENSE) © 2026 Karan Rao
