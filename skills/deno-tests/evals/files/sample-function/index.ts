import { createClient } from "jsr:@supabase/supabase-js@2";

function banDurationFor(strikeCount: number): string {
  if (strikeCount >= 3) return "87600h";
  if (strikeCount === 2) return "168h";
  if (strikeCount === 1) return "24h";
  return "0h";
}

function buildFullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Unknown User";
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { user_id, strike_count } = await req.json();

  const duration = banDurationFor(strike_count);
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("id", user_id)
    .single();
  const fullName = buildFullName(profile?.first_name, profile?.last_name);

  return new Response(JSON.stringify({ fullName, duration }), {
    headers: { "Content-Type": "application/json" }
  });
});
