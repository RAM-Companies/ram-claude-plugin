-- supabase/migrations/00000000000000_init.sql (existing baseline, for reference only — do not edit)
CREATE TABLE IF NOT EXISTS "public"."quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL,
  "total_cents" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select_own" ON "public"."quotes"
  FOR SELECT
  USING (auth.uid() = customer_id);

GRANT SELECT ON "public"."quotes" TO authenticated;
GRANT ALL ON "public"."quotes" TO service_role;
