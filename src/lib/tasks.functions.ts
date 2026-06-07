import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) return { tasks: [] };
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tasks: data ?? [] };
  });

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_worker_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tasks: data ?? [] };
  });

const StatusInput = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]),
  note: z.string().max(500).optional(),
});

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .update({ status: data.status })
      .eq("id", data.taskId)
      .select("organization_id")
      .single();
    if (tErr) throw new Error(tErr.message);

    await supabase.from("task_history").insert({
      task_id: data.taskId,
      organization_id: task.organization_id,
      actor_id: userId,
      status: data.status,
      note: data.note ?? null,
    });
    return { ok: true };
  });
