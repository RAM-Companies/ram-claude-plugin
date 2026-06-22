---
name: extract-service
description: Moves database calls out of page components into reusable service functions. Use when you see direct Supabase queries in a component, or when you want to make database calls testable and reusable.
---

You are extracting Supabase queries from a component into a service layer. This is the keystone step that makes hooks and components testable — service functions take plain values and return typed data, with no React or UI concerns.

## Step 1 — Identify the target

If the user named a file, use that. Otherwise scan `git diff dev...HEAD` for components that contain `supabase.from(`. Read the full target file before touching anything.

## Step 2 — Find every direct Supabase call

Grep the target file for `supabase.from(`, `supabase.functions.invoke(`, and `supabase.auth.`. List every call with its table name, columns selected, filters, and purpose.

## Step 3 — Decide where each query belongs

Create the service file at `src/features/<domain>/<domain>Service.ts`. If the call is used across multiple features, place it in `src/shared/lib/<domain>Service.ts`. If a file already exists for that domain, append to it rather than creating a second file.

Group queries by the resource they access — one service file per domain (e.g. `quotesService.ts`, `crewService.ts`), not one per component. If a query touches a table with no obvious domain home, create a sensibly named service file and note it to the user.

## Step 4 — Write the service functions

Each service function must follow this pattern exactly:

```ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Entity = Database["public"]["Tables"]["<table_name>"]["Row"];

export async function getActiveEntities(): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("<table_name>")
    .select("id, name, status, created_at")
    .eq("active", true);
  if (error) throw error;
  return data;
}
```

Rules:

- **Never `SELECT *`** — list only the columns the component actually uses
- **Always `throw error`** on failure — no silent nulls
- **Return type must be explicit** — derive it from `Database["public"]["Tables"][...]["Row"]` or a `Pick<>` of it
- **One function per logical operation** — don't bundle a fetch + upsert into one function
- **Name functions by action and entity**: `getActiveEntities`, `createRecord`, `updateStatus`

If the original call had `.catch(() => {})` or silently ignored errors, do not carry that forward. The service function throws; the component calls `toast.error()` in its catch handler.

## Step 5 — Update the component

Replace each inline `supabase.from(...)` block with a call to the service function. The component should:

1. Import the service function from `@/features/<domain>/<domain>Service` (or `@/shared/lib/<domain>Service` if shared)
2. Call it inside `useEffect` (or wherever the original call was)
3. Handle errors with `toast.error(message)` — not silently

```ts
// Before
useEffect(() => {
  supabase
    .from("<table_name>")
    .select("*")
    .then(({ data }) => {
      if (data) setItems(data);
    });
}, []);

// After
useEffect(() => {
  getActiveEntities()
    .then(setItems)
    .catch(() => toast.error("Failed to load items"));
}, []);
```

## Step 6 — Verify

Run `npm run build`. If there are TypeScript errors, fix them — do not add `as any` casts. Run `npm run test` to confirm no regressions.

## Step 7 — Report

Tell the user:

- Which service file(s) were created or updated
- How many queries were extracted
- Whether any errors were silently swallowed and are now surfaced
