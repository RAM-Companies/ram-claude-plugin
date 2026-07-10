import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Quote = Database["public"]["Tables"]["quotes"]["Row"];

export async function getAll(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, customer_id, total_cents, created_at");
  if (error) throw error;
  return data;
}
