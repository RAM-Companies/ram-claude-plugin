import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Approval {
  id: string;
  status: string;
}

export function SamplePage() {
  // --- Shared page state, used by both sections below ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // --- Section A: Approvals list — fully self-contained, only reads/writes its own state ---
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("approvals")
      .select("id,status")
      .then(({ data }) => setApprovals(data ?? []))
      .finally(() => setApprovalsLoading(false));
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Section A: Approvals list */}
      <section>
        {approvalsLoading ? (
          <p>Loading approvals...</p>
        ) : (
          <ul>
            {approvals.map((a) => (
              <li key={a.id}>{a.status}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Section B: Customer picker — shares selectedCustomerId with the rest of the page */}
      <section>
        <button onClick={() => setSelectedCustomerId("123")}>Pick customer</button>
        {selectedCustomerId && <p>Selected: {selectedCustomerId}</p>}
      </section>
    </div>
  );
}
