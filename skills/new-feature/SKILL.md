---
name: new-feature
description: Scaffold a new feature folder following feature-based architecture. Use when starting work on a new user-facing capability that owns its own data, UI, and logic.
---

You are scaffolding a new feature for a React / TypeScript / Supabase application following feature-based architecture. Every new capability lives in its own folder under `src/features/<name>/` — isolated, self-contained, and independently navigable.

## When to create a new feature folder

Create a new feature folder when you are adding a new user-facing capability that:

- Has its own data (reads from or writes to Supabase)
- Has its own UI (one or more React components)
- Has its own logic (service functions, hooks, or types)

Do **not** create a new feature folder for:

- A new component inside an already-existing feature (add it to the existing feature folder)
- A utility or helper used across multiple features (add it to `src/shared/lib/`)
- A UI primitive (those belong in `src/shared/components/ui/`)

## Step 1 — Name the feature

Choose a short, lowercase, noun-based name (e.g. `quotes`, `notifications`, `billing`, `reports`). This becomes the folder name and the prefix for all service functions and type exports.

## Step 2 — Create the folder structure

Create the following at `src/features/<name>/`:

```text
src/features/<name>/
├── components/           ← React components used only by this feature
├── <Name>Service.ts      ← all Supabase queries for this feature
└── types.ts              ← feature-specific TypeScript types (create when needed)
```

Start minimal — create `hooks/` and `*.test.ts` files only when you have content to put in them. Do not create empty placeholder files.

## Step 3 — Create the service file

`<Name>Service.ts` is the only place in this feature that calls Supabase directly. No component in this feature should call `supabase.from()` — all data access goes through the service.

```ts
// src/features/<name>/<Name>Service.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Entity = Database["public"]["Tables"]["<table_name>"]["Row"];

export async function getAll(): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("<table_name>")
    .select("id, name, created_at");
  if (error) throw error;
  return data;
}
```

Rules: no `SELECT *`, explicit return types, `throw error` on failure, one function per operation.

## Step 4 — Create the first component

Place it at `src/features/<name>/components/<ComponentName>.tsx`. Keep it focused — one responsibility per component.

```tsx
// src/features/<name>/components/<ComponentName>.tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAll } from "../<Name>Service";
import type { Database } from "@/integrations/supabase/types";

type Entity = Database["public"]["Tables"]["<table_name>"]["Row"];

export function <ComponentName>() {
  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAll()
      .then(setItems)
      .catch(() => toast.error("Failed to load <entities>"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  return (/* JSX */);
}
```

## Step 5 — Wire it into the app

Import the component into the relevant page. The page file only renders the component — no logic goes directly in the page:

```tsx
// src/pages/<PageName>.tsx
import { <ComponentName> } from "@/features/<name>/components/<ComponentName>";

// Inside the JSX:
<ComponentName />
```

## Step 6 — The shared/ boundary

Code stays feature-local until it is genuinely used by **two or more features**. When that happens, move it:

- Pure logic → `src/shared/lib/<util>.ts`
- React components → `src/shared/components/<ComponentName>.tsx`

A feature folder must **never import from another feature folder**. Cross-feature dependencies always go through `src/shared/`. If you find yourself importing from `../other-feature/`, that is a signal to move the shared code first.

## Step 7 — What does NOT go in a feature folder

| Item                                     | Correct location                      |
| ---------------------------------------- | ------------------------------------- |
| UI primitives (buttons, inputs, dialogs) | `src/shared/components/ui/`           |
| Auth context and session wrappers        | `src/shared/lib/auth.tsx`             |
| Supabase client                          | `src/integrations/supabase/client.ts` |
| Auto-generated DB types                  | `src/integrations/supabase/types.ts`  |
| Shared Tailwind constants                | `src/shared/lib/styles.ts`            |

## Step 8 — Verify

```bash
npm run build
```

The build must pass. Also confirm:

- No feature folder imports from another feature folder
- All Supabase calls are in `<Name>Service.ts`, not in components
- Components handle loading and error states visibly — no blank sections with no feedback
