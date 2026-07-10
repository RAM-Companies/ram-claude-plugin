import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Crew {
  id: string;
  name: string;
  active: boolean;
}

export function SampleComponent() {
  const [crew, setCrew] = useState<Crew[]>([]);

  useEffect(() => {
    supabase
      .from("crew")
      .select("*")
      .eq("active", true)
      .then(({ data }) => {
        if (data) setCrew(data);
      })
      .catch(() => {});
  }, []);

  async function deactivate(id: string) {
    await supabase.from("crew").update({ active: false }).eq("id", id);
  }

  return (
    <ul>
      {crew.map((c) => (
        <li key={c.id}>
          {c.name}
          <button onClick={() => deactivate(c.id)}>Deactivate</button>
        </li>
      ))}
    </ul>
  );
}
