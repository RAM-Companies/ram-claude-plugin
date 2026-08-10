---
name: create-edge-function
description: Scaffold a new Supabase Edge Function (a Deno-based HTTP endpoint) with CORS, the right auth model, and business logic separated out for unit testing. Use whenever the user wants to add a new Edge Function, create a new Supabase-backed HTTP API endpoint, add a webhook or callback handler that lives under supabase/functions, or build a server-to-server integration point on Supabase. Trigger even when they don't say "Edge Function" by name — e.g. "add an endpoint that lets X call into Supabase," "I need a webhook for Y," "add a server-to-server API for Z," "this needs a new function admin-manage-whatever," "let our partner push data into our app," "make our app able to receive orders from the partner API."
---

Scaffold a new Supabase Edge Function. Every step below matters — auth model and CORS are the two most common places a new function ships broken or insecure, and untestable logic is the most common place it ships buggy.

## Step 1 — Learn the project's _structure_, but don't trust its _judgment calls_

Before writing anything, read 2-3 existing functions under `supabase/functions/` (if any exist) to learn the project's shape:

- A shared helpers folder (commonly `_shared/`) — CORS, auth extraction, and other cross-function utilities usually live there. Reuse them; don't re-implement.
- Whether logic is split into a `_lib.ts` alongside `index.ts`.
- The test file naming and test runner in use.
- The `config.toml` pattern for registering functions.

That's the part safe to copy — it's organizational, not a security or correctness decision. What's _not_ safe to copy without checking: whatever the closest existing function does for secret comparison, error responses, input validation, or anything else that could be a live bug. An existing function is an example of house style, not a verified-correct reference implementation — it was written by the same fallible process you're running now, and it may already contain exactly the kind of issue `review-edge-function` is designed to catch (constant-time secret comparison, internal error details leaking to the caller, missing bounds checks, and so on). If the pattern you're about to reuse handles a secret, an error response, or a trust boundary, verify it independently against the steps below before copying it — don't paste it in just because "that's what the last function did." If this is the first function in the project, follow the patterns below directly.

## Step 2 — Clarify the auth model before anything else

Ask if not already stated: **who calls this function?**

- A logged-in user's browser, holding a Supabase session JWT?
- Another server/service, with no user session (shared secret, signature, or API key)?
- Fully public, no auth at all?

This single answer determines the gateway config, the code inside the handler, and the CORS shape — get it settled before scaffolding files.

## Step 3 — Pick the framework: raw Deno.serve, or Hono + zod-openapi for external-facing functions

Ask alongside Step 2, since it's the same kind of question: **is this function called by another application or codebase** — a partner integration, a separate product, anything outside this app's own frontend — where a durable, inspectable API contract matters to whoever's calling it? Or is this purely internal glue, called only by this app's own browser client?

- **External-facing** (another app or service is the consumer): use [Hono](https://hono.dev) with [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) instead of raw `Deno.serve`. Define each route's request/response shape as a Zod schema on the route itself, and Hono generates an OpenAPI spec from those schemas automatically, served from a route you pick (commonly `/openapi.json` or `/doc`). This buys two real things: request validation that's actually enforced, and a contract another team's codebase can read without asking you. That's the payoff — not Hono's router, which barely matters when the function is already a single endpoint. Before writing any route, add `hono` and `@hono/zod-openapi` to `supabase/functions/deno.json`'s `imports` map as `npm:` specifiers (the same mechanism already used there for `@supabase/supabase-js`) — neither resolves under Deno without that entry, regardless of whether a same-named package sits in the project's root `package.json` for its frontend; that's a separate runtime and a separate dependency tree, and doesn't make the package available here. Same check applies if you're leaning on an existing `zod` dependency for schemas — confirm it's in `deno.json`'s import map too, not just `package.json`.
- **Internal-only** (this app's own frontend is the only caller): stay with raw `Deno.serve`. Pulling in a routing framework and an OpenAPI generator for an endpoint nobody outside this codebase will ever consume a spec for is unjustified weight — plain request parsing is simpler to read and to deploy.

Whichever you pick, the rule in Step 6 still holds unchanged: the HTTP layer — a Hono route handler or a `Deno.serve` callback, doesn't matter which — stays thin, and the real logic lives in `_lib.ts`.

After building the function, grep `supabase/functions/` for sibling functions serving the same external caller or integration (e.g. other functions for the same partner). If they exist and don't follow the convention you just used here — this one's on Hono while they're on raw `Deno.serve`, or vice versa — tell the user in your final response that those siblings are now inconsistent and should be updated to match, as a follow-up task. Don't block finishing this function on it, and don't silently say nothing — an integration split across two conventions is easy to miss until someone has to maintain both.

## Step 4 — Set gateway-level auth in config.toml

Supabase's function gateway checks the caller's JWT _before_ your code runs — this is the platform default (`verify_jwt = true`) and it rejects unauthenticated callers ahead of the handler, similar to a platform-level `[Authorize]` filter that runs before any controller code. Every function typically needs an entry in `config.toml` even with no overrides, since some deployment flows (e.g. preview/branch environments) key off that registration.

- User-JWT-called functions: leave the default (`verify_jwt = true`, no override needed).
- True server-to-server calls: set `verify_jwt = false` **only when the handler itself verifies a shared secret or signature**, as the first thing it does. Compare the secret with a constant-time comparison, not `!==`/`===` — a naive string comparison leaks timing information a partner's server could use to guess the secret byte-by-byte. Add an inline comment explaining why the gateway check is bypassed — an unexplained `verify_jwt = false` is exactly the kind of thing that gets copy-pasted into a function where it doesn't belong.

## Step 5 — Handle CORS if a browser calls this

Any function called directly from a browser needs CORS handled, regardless of which framework you picked in Step 3:

- Respond to the `OPTIONS` preflight request before any auth or business logic runs. (Hono's `cors()` middleware does this for you; with raw `Deno.serve` you do it explicitly.)
- Reflect the request's `Origin` header back when it's on an allowlist — browsers reject `*` for credentialed requests, so a blanket wildcard silently breaks those callers.
- Include the same CORS headers on **every** response, success and error alike. A CORS header missing only on the error path is the single most common CORS bug — the browser hides the real error behind an opaque CORS failure.

Reuse the project's existing CORS helper or its allowlist logic if there is one, even if you have to adapt it to how your chosen framework wires CORS in (a raw headers object for `Deno.serve`, an origin allowlist function for Hono's `cors()` middleware) — don't re-derive the allowed-origins list from scratch. If no shared CORS helper exists yet and this function is browser-facing, add one under the shared helpers folder rather than inlining CORS logic per function.

## Step 6 — Split the handler from the logic

Two files, not one:

- **`index.ts`** — the thin HTTP layer: a `Deno.serve` callback, or Hono route handlers if you're on Hono. Parses the request, calls into the logic below, shapes the response. No business logic lives here.
- **`_lib.ts`** — pure functions: validation, parsing, calculations, branching decisions. Plain values in, plain values out. No Supabase client, no `fetch`, no I/O of any kind — that constraint is exactly what makes this file unit-testable without mocks. On Hono + zod-openapi, the Zod route schemas cover request _shape_ validation; anything beyond shape (business rules, cross-field checks) still belongs in `_lib.ts`. On raw `Deno.serve`, define the request shape as a `zod` schema in `_lib.ts` too rather than hand-rolling type/shape checks — a schema you declare once is cheaper to read and maintain than a chain of manual `typeof`/`isObj` checks, and it's what `review-edge-function` will flag if you skip it. Add `zod` to `supabase/functions/deno.json`'s `imports` map (`npm:zod@<version>`) if it isn't already there.

If the handler needs the caller's identity, extract the token from the `Authorization` header and pass it to `auth.getUser(token)` using a **service-role** client. Don't stand up a second client with the anon key just to read who's calling — one privileged client, used deliberately, is simpler to reason about than two clients with different trust levels.

## Step 7 — If the schema doesn't support this yet, say so — don't bury it in a comment

By now you know which tables and columns the handler needs. Check whether they already exist — read `supabase/migrations/`, or a generated types file if the project has one. If something's missing, that's a blocker, not a footnote:

- Surface it as an explicit call-out in your response to the user, not just a code comment that only gets noticed if someone happens to open that file later. A comment describing a missing table is easy to ship past — a direct statement that the function can't run yet is not.
- Name the actual command for this project's schema-change workflow. For a Supabase CLI project that's `supabase migration new <descriptive_name>`, followed by writing the new table/column into the generated file — never hand-editing the schema through a dashboard SQL editor. If the project documents its own convention (check CLAUDE.md/README first), defer to that over the generic default.
- Ask whether the user wants the migration created now or wants to handle it themselves. Don't silently hand back a function that references a table that doesn't exist and call the task done.

## Step 8 — Write tests for the logic file only

Use the project's existing test runner (Deno's built-in `Deno.test` plus an assertion library is the common baseline for Supabase Edge Functions). Test the pure functions in `_lib.ts` only. Never mock the Supabase client to make a test pass — if a piece of logic can't be tested without mocking Supabase, that's a sign it's still tangled with I/O and belongs in `_lib.ts` in a smaller, purer form, not a reason to reach for a mock.

## Step 9 — Register and ship

- Add the function's entry to `config.toml`, even empty, so it's picked up wherever the project's deploy tooling expects a registration.
- Check whether the project already deploys functions automatically on push (a common pattern is a CI workflow watching `supabase/functions/**`). If it does, say so instead of instructing a manual deploy — don't tell the user to run a deploy command that duplicates what CI already does.
- If this is a Hono + zod-openapi function, tell the user where the generated spec is served from (the route you picked in Step 3) so they can hand that URL to whoever's consuming the API.

## Step 10 — Audit what you just wrote before calling it done

Apply the `review-edge-function` skill's full checklist — Auth, CORS, Data access, Error handling, Testability, Secrets & config, API contract, Documentation — to the function you just created. That checklist is the single source of truth for what "done" looks like — it isn't restated here, so a future fix to it doesn't need a matching edit in this file too.

You already have everything the checklist needs from writing the function: don't re-read `index.ts`/`_lib.ts`/`config.toml` from disk as if seeing them fresh, and don't re-ask whether this function is external-facing — you answered that in Step 3. Just walk the checklist against what you already know and wrote.

If any finding it surfaces traces back to something you copied from an existing function rather than a deliberate decision, that's the signal to go verify it now rather than ship it.

Any CRITICAL or WARNING finding the audit surfaces — copied or not — gets fixed before you call the function done. Reporting it and moving on is `review-edge-function`'s job when auditing someone else's function after the fact; here, you just wrote it, so an unresolved CRITICAL/WARNING finding means the function isn't finished yet.

## Commit checklist

- [ ] `index.ts` and `_lib.ts` (or the Hono route + `_lib.ts` split)
- [ ] Test file for `_lib.ts`
- [ ] `config.toml` entry for the function, even if empty
- [ ] Any new `deno.json` import-map entries added (`hono`, `@hono/zod-openapi`, `zod`, etc.)
- [ ] New migration file, if Step 7 surfaced a missing table/column
- [ ] Step 10's audit run, with any CRITICAL/WARNING finding fixed, not just reported

## Rules

- Never leave a missing table or column as a code comment for someone to discover later — call it out to the user directly and name the migration command to fix it.
- Never treat "the existing function does it this way" as sufficient justification for a security- or correctness-relevant choice — that's a hypothesis to verify, not a rule to follow.
