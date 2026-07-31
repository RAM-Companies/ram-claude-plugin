---
name: create-edge-function-client
description: Generate a typed client for calling a Supabase Edge Function's HTTP API from its OpenAPI spec — request/response types plus a thin fetch wrapper. Use whenever the user wants to call an existing Edge Function from a frontend, from another Edge Function (server-to-server), or from a separate external codebase, and wants generated types instead of hand-written fetch calls. Trigger on "generate a client for this function," "add types for calling this API," "I need to call function X from function Y," or "consume this OpenAPI spec."
---

Generate a typed client from an Edge Function's OpenAPI spec. This only works for functions built on Hono + `@hono/zod-openapi` (see the `create-edge-function` skill's framework step) — a spec is the whole point, and a raw `Deno.serve` function doesn't produce one.

## Step 1 — Identify the consumer and its auth model

Ask if not already stated, same question `create-edge-function` Step 2 asks from the other side: **what's calling this function?**

- **This app's own browser frontend** — auth is the caller's Supabase session JWT.
- **Another Edge Function** (server-to-server, same or different project) — auth is a shared secret or signature, read from an environment variable, matching whatever the target function's `config.toml`/handler expects (see `create-edge-function` Step 4).
- **A separate external codebase** (partner integration, another product) — confirm which of the above two auth shapes that codebase actually uses; don't assume JWT just because it's the default case.

This determines both where the generated files live (Step 3) and how the client authenticates (Step 5) — settle it before generating anything.

## Step 2 — Get the OpenAPI spec

- **Own function**: find the spec route it serves (the route picked in `create-edge-function` Step 3, commonly `/openapi.json` or `/doc`). Fetch it from a running local dev server (`supabase functions serve`) if one is up, otherwise from the deployed URL.
- **External function**: ask the user for the spec's URL or a local file path.
- **No spec available** (the function is still on raw `Deno.serve`): stop here. Tell the user this function needs to move to Hono + `@hono/zod-openapi` first — point at the `create-edge-function` skill's framework step — rather than hand-writing types against undocumented behavior. Don't guess at the shape of a response by reading handler code and typing it manually; that drifts from reality the moment the handler changes.

## Step 3 — Add the codegen deps to the _right_ runtime

The consumer identified in Step 1 decides where these deps go — get this wrong and the client either doesn't resolve or pulls in a whole Node toolchain the Deno function doesn't need:

- **Consumer is a Node frontend**: add `openapi-typescript` and `openapi-fetch` to that app's `package.json`.
- **Consumer is another Edge Function**: add `openapi-fetch` as an `npm:` specifier to _that function's_ `supabase/functions/deno.json` import map — the same mechanism `create-edge-function` uses for `hono`/`zod`. `openapi-typescript` itself stays a dev-time-only CLI run via `npm`/`npx`; its output is a plain `.ts` file of type declarations with no runtime dependency, so it's portable into Deno even though the generator never runs there.

## Step 4 — Wire up the regen script and generate types

Check the consuming project for an existing generated-types script convention first — e.g. if it already has a `gen:db-types` script for `supabase gen types typescript`, match that naming rather than inventing a new pattern. Add a script that runs:

```bash
openapi-typescript <spec-url-or-path> -o <output-path>/api-types.ts
```

Before picking `<output-path>`, check whether the project already has an API-client folder convention (grep for prior generated types or fetch wrappers). Reuse that location; don't invent a new structure if one exists.

**Check before running codegen, not after.** If a types file (or the client wrapper from Step 5) already exists at that location — from a previous run of this skill, or committed some other way — don't silently overwrite it and don't silently leave it alone either. Tell the user it's already there and ask whether to regenerate (the spec may have changed since it was last generated) or leave it as-is. Only run the codegen command once that's settled. Regeneration is manual either way — re-run this script whenever the source function's spec changes. This skill doesn't wire it into a watch task or CI step unless the user asks for that.

## Step 5 — Build the thin client wrapper

Use `openapi-fetch`'s `createClient<paths>()` against the generated types, with a fetch middleware that injects the right auth header per Step 1:

- **Browser frontend caller**: pull the current Supabase session JWT (`supabase.auth.getSession()`) and set it as the `Authorization` header. Refresh it per-request rather than caching it once — a cached token expires mid-session.
- **Server-to-server caller** (another Edge Function or an external backend): read the shared secret from an environment variable (`Deno.env.get(...)` or `process.env`, matching the consumer's runtime) and set it on whatever header the target function's handler checks. This is a plain header set, not a security check — the constant-time comparison requirement from `create-edge-function` Step 4 applies to the _receiving_ handler, not this client.

Keep this wrapper thin — one file, no business logic. It shapes the request/response, nothing else.

## Step 6 — Commit generated output

Commit both the generated types file and the client wrapper — they're not gitignored. Say so explicitly to the user if this is the first time the project has committed generated API types, so it's a deliberate choice, not a surprise in the diff.

## Commit checklist

- [ ] Generated types file present and committed
- [ ] Client wrapper committed, auth middleware matches the caller identified in Step 1
- [ ] Regen script added, named to match the project's existing generated-types script convention if one exists
- [ ] Codegen deps added to the _consumer's_ runtime (Node `package.json` vs. the calling function's `deno.json`), not the target function's
- [ ] Told the user this only works against a Hono + `@hono/zod-openapi` spec, if that came up as a blocker

## Rules

- Never hand-type a response shape by reading handler code as a substitute for a real spec — if there's no spec, the fix is adding one (via `create-edge-function`), not typing around its absence.
- Never add `openapi-typescript`/`openapi-fetch` to the target function's own `deno.json` when it's the _consumer_ in a different function that needs them — deps go where the calling code runs, not where the API is served.
