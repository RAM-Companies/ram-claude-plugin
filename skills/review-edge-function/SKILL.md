---
name: review-edge-function
description: Audit one existing Supabase Edge Function for auth, CORS, data-access, error-handling, and testability problems. Use when the user asks to review, audit, check, or double check a specific Edge Function — e.g. "review supabase/functions/foo/index.ts," "is this webhook handler safe," "can you check this Supabase function before I ship it," "audit the auth on this endpoint." Trigger even when they don't say "Edge Function" by name — e.g. "double check how MAC talks to RIZ before we ship," "is our connection to RIZ safe," "make sure nothing leaks when RIZ calls us." Scoped to one function per run — if asked to review every function in a project, invoke this once per function rather than combining them into a single pass.
---

Audit a single Supabase Edge Function. Read the whole thing before judging any part of it — a function's safety depends on the handler, its logic file, and its gateway config agreeing with each other, not any one of them in isolation. For example, `verify_jwt = false` is only safe if the handler verifies a secret itself; reading the config without the handler (or vice versa) misses that.

## Step 1 — Read everything for this function

Read `index.ts`, its `_lib.ts` (if one exists), and its entry in `config.toml`. If the function calls out to other shared helpers (CORS, auth extraction, etc.), read those too — a bug in a shared helper affects every function that uses it.

## Step 2 — Work through each of these

**Auth**

- If the gateway JWT check is off (`verify_jwt = false` or no check configured): does the handler verify a shared secret or signature on _every_ code path, before touching any data? Check for a path that skips it — an early return, an unhandled HTTP method, a branch that doesn't hit the check.
- If the handler needs caller identity: is the token pulled from the `Authorization` header and passed to `auth.getUser()` on a service-role client — not a second, separately-configured anon-key client?
- Is any role or permission check (admin-only, owner-only) enforced server-side, rather than trusted from a value in the request body?

**CORS**

- Is `OPTIONS` handled before auth or business logic runs?
- Is the allowed origin reflected from an allowlist, not a blanket `*` — especially if responses carry credentials or sensitive data? Confirming that a shared CORS helper is _called_ is not the same as confirming it's _safe_ — open the helper itself and trace every branch, not just the happy path. A helper that resolves to `*` only when some config value is missing or unset is easy to wave through as "uses an allowlist," but that fallback is a live code path, not a hypothetical — flag it if you find one, even if this particular function doesn't look credential-sensitive, since the same helper is usually shared across every function in the project.
- Do CORS headers appear on every response path, including errors? Missing them only on errors is the most common miss, and it manifests to the caller as a confusing CORS failure instead of the real error.

**Data access**

- Any unbounded `select("*")` where the caller only needs specific columns?
- Any query that's missing a scope or ownership filter it should have (e.g., fetching by ID with no check that the caller owns that row)?
- Is the Supabase client created untyped (`createClient(url, key)`) when the project has a generated database types file (commonly `types.ts` from `supabase gen types typescript`)? An untyped client means every `.from(table).select(...)` call returns an effectively-`any` shape — a column rename or typo in a query string isn't caught until it fails at runtime. Flag it if a generated types file exists in the project but this function's client isn't parameterized with it (`createClient<Database>(url, key)`); note it as a systemic issue if every function in the project has the same gap, rather than singling this one out as uniquely at fault.
- Is validation hand-rolled (manual type/shape checks in a `_lib.ts` or similar) instead of using `zod`? Flag it and recommend switching, even if `zod` isn't in `supabase/functions/deno.json`'s `imports` map yet — hand-rolled shape validation is a maintenance cost every function pays individually (every new field is a manual check to write and a manual check to review), and that cost doesn't go away just because the dependency isn't wired up yet. Say so as part of the fix: add `zod` to `deno.json`'s `imports` map (`npm:zod@<version>`) alongside the rewrite — that's a small addition, not a reason to hold back the recommendation. Note whether `zod` is already available elsewhere in the project (root `package.json`, or another function's `deno.json` entry) so the user knows if they're aligning with existing usage or introducing it fresh.

**Error handling**

- Any `catch` block that swallows the error instead of surfacing or logging it?
- Do error responses leak internals — stack traces, raw database errors — to the caller?

**Testability**

- Is business logic (validation, calculation, branching) separated into a pure file, or tangled into the HTTP handler alongside I/O? Flag logic that's stuck in the handler and can't be unit tested without mocking Supabase.
- If tests exist, do they test pure logic only, or do they attempt to mock the Supabase client? Mocking the client is a smell — the fix is extracting the logic, not writing a better mock.

**Secrets & config**

- Any hardcoded URL, key, or secret that should be an environment variable instead?
- If `verify_jwt = false` is set, does it carry a comment explaining why?

**API contract**

- Is this function called by another application or codebase — a partner integration, a separate product, anything outside this app's own frontend — rather than only this app's own browser client? If that's not clear from the code or its callers, ask rather than assuming either way.
- If it's external-facing and still built on raw `Deno.serve` with hand-rolled request parsing, recommend switching to Hono with `@hono/zod-openapi` (see the `create-edge-function` skill's framework step): Zod-validated routes plus an auto-generated OpenAPI spec give an external consumer a real, inspectable contract instead of whatever they can reverse-engineer by calling the endpoint and reading the response. This is a structural recommendation, not evidence of a defect — surface it, but don't treat it with the weight of an auth or data-exposure finding. Before making this recommendation, check whether sibling functions serve the same external caller or integration. If they do and share the current raw-`Deno.serve` convention, say so in the recommendation — frame it as "this function and its siblings should migrate together," not an isolated nudge at the one file you happened to review.

**Documentation**

- Do exported functions in `_lib.ts` have a doc comment explaining what they do — not just restating the function name, but why it exists or what edge case it's handling? Flag exported functions with no comment at all, especially ones with non-obvious business logic.
- Does the handler explain its non-obvious decisions in comments — why `verify_jwt` is set the way it is, why a check exists, why a workaround is there? An undocumented non-obvious choice looks arbitrary and invites a future edit to break it silently.
- This is about _absence_ where the _why_ isn't obvious from the code alone — not asking for comments that just restate what the code already says.

## Step 3 — Check project-specific conventions too

If the project has its own documented conventions (a CLAUDE.md, README, contributing doc, or similar), check the function against those as well, in addition to everything above. Cite the specific rule when flagging a violation against a documented convention, so the user can trace it back.

## Step 4 — Report findings

One line per finding: `<file>:<line> - <SEVERITY> - <problem>. <fix>.`

Severity:

- **CRITICAL** — auth bypass, secret leak, data exposure to the wrong caller.
- **WARNING** — missing test coverage for real logic, unbounded query, swallowed error, missing CORS header on an error path.
- **NIT** — style, minor robustness, non-risky cleanup, missing documentation on non-security-critical logic.
- **RECOMMENDATION** — a structural suggestion that isn't evidence of a defect (e.g. an external-facing function that would benefit from a Hono + zod-openapi contract).

Skip praise. Skip anything that doesn't change behavior or risk. If there's nothing wrong, say so plainly instead of manufacturing nits.

## Rules

- Report findings only — don't rewrite the function unless the user asks for fixes.
- Every finding points to a specific line and a specific failure scenario ("if X calls this with Y, then Z happens") — not a vague "this could be better."
- One function per review. If asked to cover a whole `functions/` directory, run this once per function instead of producing one merged report.
