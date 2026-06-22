---
name: pr-review
description: Full PR review covering conventions, security, code quality, and docs accuracy for a React / TypeScript / Supabase SPA. Use when you want to check project rules and standards — not a generic code review. For general bug-hunting and code quality, use /code-review after this.
---

You are performing a thorough PR review for a React / TypeScript / Supabase SPA. The authors may be non-technical, so your review must be explicit and actionable: name the file, line, problem, and exact fix.

## Step 1 — Get the diff

Run `git diff dev...HEAD` to see all changes. Also run `git log dev...HEAD --oneline` to see the commit list. If the user passed a PR number or branch name as an argument, use that ref instead.

## Step 2 — Review each category

Work through every category. For each finding note: **file + line** (as a markdown link), **what the problem is**, and **what to do instead**. Severity: 🔴 High, 🟡 Medium, 🟢 Low.

---

### A. Project Conventions

These rules apply to every PR.

**Architecture**

- New feature code must go in `src/features/<name>/` — not added directly to existing large page files
- All Supabase queries belong in service functions in `src/features/<feature>/` (or `src/shared/lib/` if shared across features) — not called directly inside components

**Data access**

- `.select()` calls must list specific columns — no `SELECT *`
- Schema changes require a new migration file in `supabase/migrations/` — not dashboard edits or inline SQL
- If a migration was added, `src/integrations/supabase/types.ts` must be regenerated

**UI patterns**

- Destructive confirmations must use `AlertDialog` — not `window.confirm()`
- Styling must use Tailwind classes — no inline `style={{...}}` attributes

**Error handling**

- User-visible failures must call `toast.error()` — no `.catch(() => {})` silent swallows

**TypeScript**

- No new `as any` casts — use proper types or `unknown`

**Dependencies and tooling**

- Package manager is `npm` only — no `bun` usage or `bun.lockb` files

**Git hygiene**

- Commit messages must follow Conventional Commits: `type(scope): message` — valid types are `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`
- Branch must be prefixed with `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`, or `perf/` — never commit directly to `main` or `dev`

---

### B. Security

**Credentials and secrets**

- No hardcoded API keys, tokens, passwords, or Supabase credentials — use `import.meta.env.VITE_*`
- New env vars must follow the `VITE_` prefix convention and be documented in `.env`

**Access control**

- New pages or routes that read from Supabase must check for a valid user session before rendering or fetching
- Admin-only features must enforce access server-side (RLS policy or JWT claim) — a React boolean or UI-layer redirect is not sufficient enforcement
- Account creation must go through an admin Edge Function — `supabase.auth.signUp` must not be called from frontend code

**Input handling**

- User-supplied input (form fields, URL params, query strings) must be validated before being used in Supabase queries or passed to external APIs
- No `dangerouslySetInnerHTML` with unsanitized user content

**Edge Functions** (if any added or changed)

- New functions should have `verify_jwt = true` unless there is a documented reason not to
- CORS should be locked to the production domain — not `*`

**Queries**

- Queries on potentially large or unbounded tables must include `.limit()` or pagination

---

### C. Code Quality

**TypeScript**

- Function parameters and return types should be typed — watch for implicit `any` from missing annotations
- Avoid unnecessary type assertions (`as SomeType`); prefer narrowing

**React correctness**

- Lists must have `key` props that are stable and unique (not array index)
- `useEffect` dependency arrays must be complete — missing deps cause stale closure bugs
- State updates must be immutable — no direct array or object mutations

**Testing**

- If core business logic (pricing, calculations, data transforms) changed, accompanying tests in the same PR are required — untested logic changes are 🔴
- If a file with existing tests was modified, confirm the tests were also updated

**Component design**

- New components over ~300 lines should be broken up
- If the same Supabase query appears in more than one place, flag it as a candidate for a shared service function
- Async data-fetching components must handle loading and error states visibly — a blank section with no feedback is not acceptable

**New dependencies**

- For any new `npm` package: note what it does, whether a lighter alternative or browser/framework built-in exists, and whether it introduces known vulnerabilities

---

### D. README Accuracy

Check whether `README.md` needs updating based on what this PR changes. For each applicable change type, verify the corresponding section reflects reality.

| If the PR…                                | Check README section                                                  |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Adds or removes a page                    | Project Structure → `src/pages/`, Routes table                        |
| Adds or removes a feature folder          | Project Structure → `src/features/`                                   |
| Adds or removes an Edge Function          | Project Structure → `supabase/functions/`, Deployment deploy commands |
| Adds a migration with a new table         | Database Tables                                                       |
| Changes auth mechanism or security policy | Authentication & Security                                             |
| Adds or removes an `npm` script           | Other Scripts                                                         |
| Adds a new global tool dependency         | Prerequisites                                                         |
| Adds or removes a file under `scripts/`   | Project Structure → `scripts/`                                        |

Flag any section that is out of date as 🟡 Medium — README drift is not blocking but should ship in the same PR as the change that caused it.

---

### E. CLAUDE.md Accuracy

Check whether `CLAUDE.md` needs updating based on what this PR changes.

| If the PR…                                       | Check CLAUDE.md section            |
| ------------------------------------------------ | ---------------------------------- |
| Adds or removes an Edge Function                 | Edge Functions table               |
| Adds or removes a feature folder                 | Folder Structure table             |
| Adds or renames a file in `src/shared/`          | Folder Structure section           |
| Establishes or retires a "avoid" pattern         | Things to Avoid                    |
| Adds or removes an `npm` script                  | Commands section                   |
| Changes test conventions or adds a test location | Testing section                    |
| Changes an architecture rule or invariant        | Architecture — Know Before Editing |

Flag any section that is out of date as 🟡 Medium — CLAUDE.md drift is not blocking but should ship in the same PR as the change that caused it.

---

## Step 3 — Write the report

```text
## PR Review: <branch or PR title>

### Summary
One paragraph. What does this PR do? Is it safe to merge?

### 🔴 High — Must fix before merge
(list findings, or "None")

### 🟡 Medium — Should fix before merge
(list findings, or "None")

### 🟢 Low — Nice to fix (non-blocking)
(list findings, or "None")

### ✅ Looks good
(things done well — be specific)
```

For each finding: link to the file and line, describe the exact problem, give the exact fix. "Change line 142 to call `toast.error(message)` in the catch block" is better than "improve error handling."

---

## Step 4 — Deep bug review

After delivering the PR review report, ask: **"Want a deeper review for bugs and logic errors?"**

If the user confirms, run the `/code-review` skill inline and present its findings as a formatted markdown report — **do not output the raw JSON array**. Use this structure:

```text
## Deep Review: Bugs & Logic Errors

### 🔴 Critical
### 🟡 Medium
### 🟢 Low
```

For each finding: a bold one-line title linking to **file:line**, one paragraph describing the bug and the exact failure scenario, and a concrete **Fix:** line. Omit empty severity sections.
