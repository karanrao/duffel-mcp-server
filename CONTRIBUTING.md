# Contributing

This is a proof-of-concept from [agenticdirect.io](https://agenticdirect.io), shared openly. Issues,
ideas, and PRs are welcome — treat it as a reference and a starting point rather than a maintained product.

## Running it locally

See [docs/SETUP.md](docs/SETUP.md). In short: `npm install`, set a `duffel_test_` token, then
`npm run test:smoke`.

## Adding a tool

1. Create `src/tools/<your-tool>.js` exporting `{ name, description, inputSchema, handler }`.
   Validate inputs with Zod; return a compact summary, not the raw Duffel payload.
2. Call Duffel through `src/duffel-client.js` — don't make HTTP requests from the tool directly, so
   auth, the `{ data }` envelope, and error surfacing stay in one place.
3. Import it in `src/index.js` and add it to the `TOOLS` array.
4. Exercise it: add a step to a smoke test, or run it via
   `npx @modelcontextprotocol/inspector node src/index.js`.

## Conventions

- **Validate end-to-end before extending.** Run a tool against the live sandbox before building on it.
- **Match each API's real shape** rather than forcing symmetry — e.g. flights cancel in two steps,
  stays in one (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- **Don't force a cancellation into a single call.** Keep the quote/confirm or the explicit `confirm` guard.
- **Keep secrets out of the repo.** Tokens live in `.env` or the client config `env` block, never in code.

## Scope

Sandbox / test tokens only. No production payment path, no real bookings. If you extend toward
production, do a proper dependency-security and secrets review first (`npm audit`, token handling).
