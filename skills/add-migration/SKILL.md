---
name: add-migration
description: Makes a change to the database schema — add a column, create a table, add a policy, etc. (Supabase migration). Always use this instead of editing the database directly in Supabase.
---

You are creating a database migration for this Supabase project. All schema changes go through migration files — never the Supabase dashboard SQL editor.

## Step 1 — Confirm the change

Before writing any SQL, state clearly what the migration will do: which tables are affected, what columns or constraints are being added, altered, or removed, and why. If the user's description is ambiguous, ask before proceeding — a bad migration is harder to undo than a bad component.

## Step 2 — Choose a name

The name must be `snake_case`, descriptive, and ≤ 5 words. Examples:

```text
add_quote_status_column
drop_unused_device_table
add_rls_policy_profiles
create_notifications_table
```

Do not include a timestamp prefix — `supabase migration new` adds it automatically.

## Step 3 — Create the file

```bash
supabase migration new <name>
```

This creates `supabase/migrations/<timestamp>_<name>.sql`. Confirm the file was created and note the full path.

## Step 4 — Write the DDL

Edit the generated file. Follow these rules:

**Prefer additive changes.** `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `CREATE POLICY` are safe. `DROP`, `ALTER COLUMN TYPE`, and `RENAME` are destructive — warn the user and confirm before writing them.

**Use `IF NOT EXISTS` / `IF EXISTS` where PostgreSQL supports it** so the migration is idempotent and can be replayed on branch databases without error:

```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
```

PostgreSQL supports this clause for `CREATE TABLE`, `CREATE INDEX`, `CREATE SEQUENCE`, `DROP TABLE`, `DROP INDEX`, and `ALTER TABLE ... ADD COLUMN`. It does **not** support it for `CREATE POLICY`, `CREATE TRIGGER`, or `CREATE FUNCTION` — for those, use `DROP ... IF EXISTS` before recreating, or guard with a `DO $$ ... IF NOT EXISTS ... $$` block.

**Include RLS policies** for any new table. Every table should have RLS enabled and at least a read policy. Refer to existing policies in the project's initial migration for the pattern used in this project.

**Include GRANTs for any new table.** PostgREST requires explicit table-level grants in addition to RLS policies — RLS alone is not enough. Every `CREATE TABLE` must be followed by:

```sql
GRANT SELECT ON "public"."my_table" TO authenticated;
GRANT ALL    ON "public"."my_table" TO service_role;
```

Add `GRANT SELECT ... TO anon` only if unauthenticated access is intentional. Omitting these grants causes 403 errors on Supabase Branch DBs (PR previews) and local resets, even when RLS policies look correct.

**No data.** Schema only — no `INSERT`, `UPDATE`, or `COPY` statements. Seed data goes in `supabase/seed.sql`.

**No edits to existing baseline migrations.** Those files are snapshot history. All changes go in new files.

## Step 5 — Regenerate types

After writing the migration, regenerate the TypeScript types so the app's type definitions stay in sync with the new schema:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

This requires a Supabase access token with Developer-or-higher role. If the user does not have one available right now, flag that the types file must be regenerated before the PR is merged — do not skip this step silently.

## Step 6 — Write pgTAP tests

Add a test file at `supabase/tests/<migration_name>.test.sql`. Tests run via `supabase test db` against the local stack and execute inside a `BEGIN/ROLLBACK` block so no fixture data persists.

Every migration test file must include at minimum:

**Schema invariants** — assert the objects the migration created actually exist:

```sql
SELECT has_table('public', 'my_table', 'my_table exists');
SELECT has_index('public', 'my_table', 'idx_my_table_col', 'index exists');
SELECT col_is_pk('public', 'my_table', 'id', 'primary key on id');
```

**Idempotency** — if the migration uses any idempotency guards (`IF NOT EXISTS`, `DO/EXCEPTION`, `ON CONFLICT`), prove they hold by re-running the guarded SQL with `lives_ok()`:

```sql
SELECT lives_ok(
  $$CREATE INDEX IF NOT EXISTS "idx_my_table_col" ON "public"."my_table" ("col")$$,
  'Re-running CREATE INDEX IF NOT EXISTS is a no-op'
);
```

**Behavior** — for migrations that add functions, policies, or seed data, assert the logic is correct. Use the existing test files in `supabase/tests/` as templates.

Refer to the [pgTAP function reference](https://pgtap.org/documentation.html) for available assertions (`has_table`, `has_function`, `col_is_pk`, `col_is_unique`, `has_index`, `lives_ok`, `ok`, `is`, etc.).

Run the full suite before committing:

```bash
supabase test db
```

## Step 7 — Verify locally

```bash
supabase db reset
```

This rebuilds the local database from all migrations and confirms the new migration applies cleanly from scratch. If it fails, fix the SQL before committing. Run this before `supabase test db` if you haven't already — `test db` requires the local stack to be running with migrations applied.

## Step 8 — Commit

All three files must be committed together in the same PR:

- `supabase/migrations/<timestamp>_<name>.sql`
- `supabase/tests/<migration_name>.test.sql`
- `src/integrations/supabase/types.ts`

Committing the migration without the test file or the regenerated types is a common mistake — the CI db-test workflow will catch a missing test file on the next PR, but stale types cause runtime errors immediately.

Suggested commit message:

```text
feat(db): <what the migration does>
```

## Step 9 — Remind about the preview deploy

When the PR is opened against `dev`, Supabase Branches will automatically create a branch database and apply the migration. The Vercel preview deploy will point at that branch DB. This is the right place to verify the migration end-to-end before merging.
