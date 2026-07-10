CREATE TABLE "public"."quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL,
  "total_cents" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Note: no RLS enabled on this table (intentional gap for review purposes)
GRANT SELECT ON "public"."quotes" TO authenticated;
