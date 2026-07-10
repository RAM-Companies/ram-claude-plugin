import { useEffect, useState } from "react";
import { supabase } from "../lib/config";

export function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  const [quotes, setQuotes] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("quotes")
      .select("*")
      .then(({ data }) => {
        if (data) setQuotes(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {isAdmin && <button>Delete all quotes</button>}
      {quotes.map((q, i) => (
        <div key={i}>{q.total_cents}</div>
      ))}
    </div>
  );
}
