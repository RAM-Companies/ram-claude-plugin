---
name: codebase-review
description: Full audit of the entire codebase — security, performance, and software best practices. Use when reviewing a whole project (especially one built quickly with AI assistance) rather than a single PR or diff. For diff-scoped review use /ram:pr-review or /code-review instead.
disable-model-invocation: true
---

You are auditing an entire codebase, not a diff. Assume it was built rapidly with AI assistance by non-technical builders: the app likely works, but security gaps, performance traps, and structural debt may be invisible to its owners. Your job is to find what matters, explain it in plain language, and hand back a prioritized fix list — not to nitpick style.

If the user passed arguments, treat them as a focus: `$ARGUMENTS` may name a subdirectory (audit only that), or a dimension (`security`, `performance`, `practices` — run only that section). With no arguments, run everything.

## Step 1 — Orient

Build a mental map before judging anything:

1. Read `README.md`, `CLAUDE.md`, and `package.json` (scripts, dependencies).
2. Map the tree: list top-level directories, `src/` layout, `supabase/` (migrations, functions), config files.
3. Identify the stack and entry points: routes/pages, auth setup, Supabase client initialization, Edge Functions, environment variable usage.
4. Note the size: rough file and line counts. For large codebases (>200 source files), fan out — launch parallel Explore/general-purpose agents, one per area (auth, data access, UI, Edge Functions), and synthesize their findings instead of reading everything serially.

Do **not** report findings yet. This step exists so later findings are accurate about how the app actually works.

## Step 2 — Security review 🔒

This is the highest-priority section. Vibe-coded apps most commonly fail here because the app "works" identically with or without these protections.

**Secrets and credentials**

- Grep for hardcoded keys: `sk-`, `service_role`, `eyJ` (JWT-shaped strings), `password`, `secret`, `api_key`, `Bearer ` in source files
- The Supabase **service role key must never appear in frontend code** — only the anon key, via `import.meta.env.VITE_*`
- Check `.gitignore` covers `.env`, `.env.local`; run `git log --diff-filter=A --name-only -- '*.env*'` to see if a secrets file was ever committed (a key committed then deleted is still leaked — flag for rotation)

**Access control**

- Every table touched by the app needs RLS enabled with policies — read `supabase/migrations/` and flag tables with no `ENABLE ROW LEVEL SECURITY` or with permissive `USING (true)` policies on writes
- Admin-only features must be enforced server-side (RLS policy or JWT claim). A React `isAdmin` boolean or route guard is UI decoration, not security — anyone can call the API directly
- Pages that fetch user data must verify a session first
- Edge Functions should have `verify_jwt = true` unless there is a documented reason; CORS locked to the production domain, not `*`
- `supabase.auth.signUp` called from frontend code means anyone can create accounts — flag it

**Input handling**

- Form fields, URL params, and query strings validated before use in queries or external API calls
- `dangerouslySetInnerHTML` with user-supplied content
- Raw string interpolation into SQL or `.rpc()` arguments

**Dependencies**

- Run `npm audit` and report high/critical vulnerabilities with the upgrade path

## Step 3 — Performance review ⚡

- `.select('*')` or `.select()` without columns on wide tables — list specific columns
- Queries on unbounded tables with no `.limit()` or pagination — these work fine with 50 rows in dev and fall over at 50,000
- Queries inside loops or inside `.map()` — N+1 patterns; batch with `.in()` or a join
- Data fetching in `useEffect` with missing or wrong dependency arrays causing refetch storms
- Expensive computation in render bodies without `useMemo`; large lists without virtualization (>~200 rows)
- Frequently-filtered columns with no index in any migration (check `WHERE`/`.eq()` usage against `CREATE INDEX` statements)
- Heavy dependencies imported for trivial use (moment.js for one date format, lodash for one `map`) — note bundle impact
- Unoptimized images or large static assets served from the app bundle

## Step 4 — Best practices review 🧱

- **TypeScript escape hatches**: count `as any`, `any` parameters, `@ts-ignore`/`@ts-expect-error`. A handful is normal; dozens means the type system is off and bugs are invisible
- **Silent error handling**: `.catch(() => {})`, empty `catch` blocks, missing error states in data-fetching components — users see a blank screen and the owner never learns it broke
- **Architecture drift**: Supabase queries called directly inside page components instead of service functions; feature code dumped into one giant file. Point at `/ram:extract-service` and `/ram:extract-component` as the fixes
- **Duplication**: the same query, constant, or component pattern copy-pasted across files — one future edit will miss a copy
- **Oversized files**: components over ~300 lines, files over ~500
- **Dead code**: unused exports, commented-out blocks, orphaned files no route reaches
- **Testing**: does core business logic (pricing, calculations, data transforms) have any tests at all? If none exist, don't demand full coverage — name the 3–5 functions where a silent bug costs real money and point at `/ram:unit-tests` / `/ram:deno-tests`
- **Migrations hygiene**: schema changes done as migrations (not dashboard drift); `types.ts` regenerated after the latest migration

## Step 5 — Deep bug hunt with /code-review

The steps above audit structure and patterns; `/code-review` hunts for concrete correctness bugs. Run it now:

1. If there is uncommitted work or an unmerged feature branch, run the `/code-review` skill at **high** effort — recent vibe-coded work is where live bugs concentrate.
2. If the working tree is clean and merged, instead pick the 3–5 highest-risk files found during Steps 2–4 (money, auth, data mutation) and adversarially review them yourself with the same standard: for each suspected bug, state the concrete inputs and state that trigger it and the wrong result that follows. A bug you can't name a failure scenario for is not a finding.

Fold confirmed bugs into the report below — do not output raw JSON.

## Step 6 — Write the report

The reader is non-technical. Every finding must say what could go wrong in business terms, not just what rule was violated. "Anyone on the internet can read every customer's quote data" lands; "missing RLS policy" does not.

```text
# Codebase Review: <project name>

## Overview
2–3 sentences: what the app is, overall health, and the single most important thing to fix.

## Scorecard
| Area | Grade | One-line summary |
| --- | --- | --- |
| Security | 🔴/🟡/🟢 | ... |
| Performance | 🔴/🟡/🟢 | ... |
| Code practices | 🔴/🟡/🟢 | ... |
| Testing | 🔴/🟡/🟢 | ... |

## 🔴 Critical — fix this week
For each: **plain-language title**, file:line links, what an attacker/failure looks like in practice, and the exact fix (or the /ram: skill that performs it).

## 🟡 Important — fix this month
Same format.

## 🟢 Improvements — when convenient
Brief list.

## ✅ Done well
Be specific — the owners should know what to keep doing.

## Suggested order of work
Numbered list, dependencies respected (e.g. "enable RLS before adding features that touch those tables"). Where a /ram: skill automates a fix, name it.
```

Rules for findings:

- Every finding links to **file:line**
- Severity reflects real-world impact, not rule pedantry: exposed data and money bugs are 🔴; a missing `useMemo` is 🟢
- Give the exact fix, not "improve X" — show the corrected line or the command to run
- Cap the report at what's actionable: the top ~25 findings, with a one-line note if more exist ("plus 14 more `select('*')` sites — fix the pattern once and sweep with /ram:find-usages")

## Step 7 — Offer next steps

End by asking which critical finding to fix first, and note that fixes should go through `/ram:git-workflow` (branch from `dev`, conventional commits) rather than direct edits to `main`.
