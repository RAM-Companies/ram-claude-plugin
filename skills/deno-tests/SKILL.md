---
name: deno-tests
description: Writes Deno unit tests for Supabase Edge Functions in supabase/functions/. Use when adding tests to an Edge Function, when a PR touches a function without test coverage, or when asked to unit test any file under supabase/functions/. The pattern is to extract pure logic into a _lib.ts module and test that — do not attempt to mock the Supabase client.
---

You are writing unit tests for Supabase Edge Functions. The test runtime is **Deno** using `Deno.test()` blocks and `assertEquals` (and friends) from `@std/assert`.

The shared `deno.json` at `supabase/functions/deno.json` already has `@std/assert` mapped and a `test` task. Run tests with:

```bash
cd supabase/functions && deno task test
```

## Step 1 — Identify the target

If the user named a function, use it. Otherwise look at `git diff dev...HEAD` for changes under `supabase/functions/` and pick the most obvious candidate.

Read `supabase/functions/<name>/index.ts` in full before writing anything.

## Step 2 — Decide what to extract

Edge Functions mix two concerns: HTTP plumbing (parsing requests, calling Supabase, returning responses) and pure logic (data transforms, string manipulation, state machines, conditional branches). Only the pure logic is worth unit-testing without a running stack.

For each piece of logic, ask: _can I call this with plain JS values and get a deterministic result?_ If yes, it belongs in `_lib.ts`. Common candidates:

- Data mapping/enrichment (joining arrays, applying defaults)
- String transforms (name assembly, digit extraction, value comparison)
- Status code / response variant selection based on error messages
- In-memory rate limiter state machines
- Any conditional that encodes business rules

Skip: anything that calls `supabase`, reads `Deno.env`, or touches `req`/`Response`.

## Step 3 — Create (or update) `_lib.ts`

Create `supabase/functions/<name>/_lib.ts` and export each extracted function with explicit TypeScript types. Keep interfaces close to what the DB returns — use `string | null` and optional fields rather than inventing stricter shapes.

Example pattern:

```ts
export interface Profile {
  user_id: string;
  first_name?: string | null;
  // ...
}

export function buildFullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
```

If `_lib.ts` already exists, read it and add to it rather than overwriting.

## Step 4 — Update `index.ts`

Replace the inline implementations with imports from `./_lib.ts`. The behavior must be identical — this is purely a refactor to make logic testable. Run a quick diff in your head: every logic path that existed before should still exist after.

Check the IDE diagnostics after editing to confirm no unused imports were left behind.

## Step 5 — Write `index.test.ts`

Create `supabase/functions/<name>/index.test.ts`. Import from `@std/assert` and `./_lib.ts`.

```ts
import { assertEquals } from "@std/assert";
import { myFunction } from "./_lib.ts";

Deno.test("myFunction: describes the expected behavior", () => {
  const result = myFunction(input);
  assertEquals(result, expected);
});
```

**Coverage to aim for per extracted function:**

- Happy path with realistic data
- Missing / null inputs (confirm defaults kick in correctly)
- Edge cases specific to the function's logic (boundary values, empty arrays, the exact strings/values that trigger variant behavior)

**Naming:** `Deno.test` descriptions should read as a sentence with the function name first: `"enrichUser: falls back to email when no profile"`, `"banDurationFor: inactive user returns '87600h'"`.

**What to avoid:**

- Do not mock `createClient` or Supabase responses — test the pure functions only
- Do not test that `Deno.serve` routes correctly — that's integration territory
- Do not write trivially-always-passing assertions

## Step 6 — Run and fix

```bash
cd supabase/functions && deno task test
```

If tests fail, fix the test or the assertion. If you discover a genuine bug in the source during extraction, report it to the user rather than silently fixing it.

## Step 7 — Report

Tell the user:

- Which functions were extracted into `_lib.ts` and what each does
- How many test cases were added and what behaviors they cover
- Whether all tests pass
- Anything skipped and why (e.g. "skipped `handleLogin` — requires Supabase auth client")
