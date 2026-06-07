import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TaskCard, type Task } from "@/components/TaskCard";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { getMyContext } from "@/lib/profile.functions";
import { listTasks, updateTaskStatus } from "@/lib/tasks.functions";
import { listMembers } from "@/lib/members.functions";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const fetchMe = useServerFn(getMyContext);
  const fetchTasks = useServerFn(listTasks);
  const fetchMembers = useServerFn(listMembers);
  const updateStatus = useServerFn(updateTaskStatus);
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers() });

  useTasksRealtime(meQ.data?.organization?.id);

  const org = meQ.data?.organization;
  const primaryRole = meQ.data?.roles?.[0]?.role;
  const isManager = primaryRole === "owner" || primaryRole === "supervisor";

  if (!org) {
    return <AppShell title="Tasks"><p className="text-muted-foreground">No organization.</p></AppShell>;
  }

  const memberById = new Map(
    (membersQ.data?.members ?? []).map((m) => [m.id, m.full_name ?? "Unnamed"]),
  );

  async function handleStatus(taskId: string, status: Task["status"]) {
    try {
      await updateStatus({ data: { taskId, status } });
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const tasks = (tasksQ.data?.tasks ?? []) as Task[];
  const byStatus = {
    active: tasks.filter((t) => t.status === "pending" || t.status === "assigned" || t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "completed" || t.status === "cancelled"),
  };

  return (
    <AppShell title="Tasks" subtitle={org.name}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
      </div>

      {isManager && (
        <div className="mb-6">
          <VoiceRecorder organizationId={org.id} defaultLanguage={org.default_language ?? "en"} />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active ({byStatus.active.length})
        </h2>
        <div className="grid gap-3">
          {byStatus.active.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No active tasks. {isManager && "Record a voice instruction above to create some."}
            </div>
          )}
          {byStatus.active.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              workerName={t.assigned_worker_id ? memberById.get(t.assigned_worker_id) : undefined}
              onStatusChange={isManager ? (s) => handleStatus(t.id, s) : undefined}
            />
          ))}
        </div>
      </section>

      {byStatus.done.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed ({byStatus.done.length})
          </h2>
          <div className="grid gap-3 opacity-75">
            {byStatus.done.map((t) => (
              <TaskCard key={t.id} task={t} workerName={t.assigned_worker_id ? memberById.get(t.assigned_worker_id) : undefined} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
