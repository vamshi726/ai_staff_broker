import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime task changes. Invalidates the given query keys on any event.
 */
export function useTasksRealtime(orgId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`tasks-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `organization_id=eq.${orgId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["tasks"] });
          qc.invalidateQueries({ queryKey: ["my-tasks"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
