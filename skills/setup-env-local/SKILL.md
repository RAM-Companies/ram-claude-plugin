---
name: setup-env-local
description: Configure VITE_SUPABASE_ANON_KEY in .env.local for RAM Supabase projects — use when the user is missing the anon key, can't connect to Supabase locally, or is setting up their dev environment for the first time.
---

Guide the user to find their Supabase anon key and write it to `.env.local`.

**Never show the key value** in any response — not when confirming a write, not in error messages, not in fallback instructions.

## Step 1 — Find the project root

Search the git repo root and its immediate subdirectories (depth 1, excluding `node_modules`) for a directory containing both `package.json` and a Vite config (`vite.config.ts`, `.js`, or `.mjs`).

- **One match** → use it as `<project-root>`, proceed to Step 2.
- **No match** → ask: "I couldn't find a Vite project. Are you using Vite? If not, the variable name and file location may differ for your framework (e.g., Next.js uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`)." Wait for clarification before continuing.
- **Multiple matches (monorepo)** → ask which directory to write `.env.local` to. Verify it contains `package.json` and a Vite config, warn if it doesn't, and confirm with the user before proceeding. After two failed attempts, offer: "Would you like to specify the full absolute path manually?"

## Step 2 — Check current state

Read `<project-root>/.env.local`. Three cases:

- **Key is set and non-empty** → ask: "`<project-root>/.env.local` already has a value for `VITE_SUPABASE_ANON_KEY`. Do you want to replace it?" If yes, continue to Step 3. Otherwise stop.
- **File missing, key line absent, or key is empty** → continue to Step 3.
- **Read error** → tell the user: "I could not read `<project-root>/.env.local`. Please check file permissions and try again, or open the file manually." Stop until resolved.

## Step 3 — Get the project ref

Read `<project-root>/.env` and look for `VITE_SUPABASE_URL`. Extract the project ref — it's the subdomain in `https://<project-ref>.supabase.co`. If `.env` can't be read for any reason, treat the auto-resolve as failed and fall through to the "If not found" path below.

**If found**, tell the user:

> Your anon key is at:
>
> https://supabase.com/dashboard/project/<project-ref>/settings/api
>
> Under **Project API keys**, copy the **anon / public** key (it starts with `eyJ...`). Once you've copied it, paste it here and I'll write it to `.env.local`. If that URL points to the wrong project, let me know the correct ref and I'll use that instead.

**If not found**, ask:

> What is your Supabase project ref or dashboard URL? (e.g., `myproject` or `https://supabase.com/dashboard/project/myproject/settings/api`)

Extract the project ref from whatever they provide: if they gave a bare name (e.g., `myproject`), use it directly; if they gave a URL, extract the path segment immediately after `/project/` (e.g., `https://supabase.com/dashboard/project/myproject/...` → `myproject`). Store this as `<project-ref>`. If the user cannot provide a ref, proceed without it.

## Step 4 — Validate the key

Once the user pastes the key:

1. **Format check:** It must start with `eyJ`, be at least 100 characters, and contain exactly two `.` separating three base64 segments. If not, respond: "That doesn't look like a valid anon key — it should start with `eyJ` and be a long JWT. Please copy it again from the dashboard under Project API keys > anon / public."

2. **Service-role check:** Decode the middle segment of the JWT (the base64url string between the first and second `.`) and inspect the `role` claim. If `role` is `service_role`, respond: "That's the service_role key, which must never be used in client-side code. Please copy the anon / public key instead." Do not proceed until they provide the correct key. Apply this check regardless of what the user said about which key they copied.

3. **Cross-project note:** If `<project-ref>` is known (either extracted from `.env` or provided by the user), inform the user: "I can't verify this key belongs to project `<project-ref>`, but I'll proceed. If auth still fails after restarting, confirm you copied the key from the correct project."

## Step 5 — Write the key

Write to `<project-root>/.env.local`:

- **File doesn't exist** → create it with a single line: `VITE_SUPABASE_ANON_KEY=<key>`
- **Line present and non-empty** → replace that line in place, preserving all other contents.
- **Line present but empty** → replace that line in place.
- **File exists but line is missing** → append `VITE_SUPABASE_ANON_KEY=<key>` on a new line, ensuring it starts on its own line regardless of whether the file already ends with a newline.

After writing, tell the user: "`.env.local` has been updated. Restart your dev server (e.g., `npm run dev`) so Vite picks up the change."

If the write fails, tell the user: "I couldn't write to `.env.local`. Please open `<project-root>/.env.local` manually and add a line in the format `VITE_SUPABASE_ANON_KEY=<your-key>`, replacing `<your-key>` with the value you copied." Do not include the actual key value in this message.

## Troubleshooting

**Auth errors persist after restarting the dev server:**
> The key is written correctly. Check: (1) did you fully stop and restart the server? (2) is your Supabase project paused? (3) are RLS policies blocking the query? (4) did you copy the anon/public key, not the service_role key?

**`VITE_SUPABASE_ANON_KEY` is undefined at runtime:**
> Ensure `.env.local` is in the same directory as your `vite.config.*` file — Vite only loads env files from the project root. Run `ls -la` in your project root to confirm the file is there.

## Rules

- The key belongs only in `.env.local`, never in `.env` (which is committed).
- Never commit `.env.local` — it's gitignored.

## Checklist

- [ ] `<project-root>/.env.local` contains `VITE_SUPABASE_ANON_KEY` with a non-empty value
- [ ] `VITE_SUPABASE_URL` is set (in `.env` or `.env.local`) — if absent, the Supabase client will fail even with a valid anon key
- [ ] `.env.local` is listed in `.gitignore` (confirm it will not be committed)
- [ ] Dev server restarted so Vite picks up the new value
