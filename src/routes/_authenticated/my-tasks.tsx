import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TaskCard, type Task } from "@/components/TaskCard";
import { getMyContext } from "@/lib/profile.functions";
import { listMyTasks, updateTaskStatus } from "@/lib/tasks.functions";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
});

function MyTasksPage() {
  const fetchMe = useServerFn(getMyContext);
  const fetchMyTasks = useServerFn(listMyTasks);
  const updateStatus = useServerFn(updateTaskStatus);
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const tasksQ = useQuery({ queryKey: ["my-tasks"], queryFn: () => fetchMyTasks() });

  useTasksRealtime(meQ.data?.organization?.id);

  async function handleStatus(taskId: string, status: Task["status"]) {
    try {
      await updateStatus({ data: { taskId, status } });
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const tasks = (tasksQ.data?.tasks ?? []) as Task[];
  const active = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "completed" || t.status === "cancelled");

  return (
    <AppShell title="My tasks" subtitle="Tasks assigned to you, in your language.">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          To do ({active.length})
        </h2>
        <div className="grid gap-3">
          {active.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No tasks yet. Your supervisor will assign tasks soon.
            </div>
          )}
          {active.map((t) => (
            <TaskCard key={t.id} task={t} workerView onStatusChange={(s) => handleStatus(t.id, s)} />
          ))}
        </div>
      </section>
      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed ({done.length})
          </h2>
          <div className="grid gap-3 opacity-75">
            {done.map((t) => <TaskCard key={t.id} task={t} workerView />)}
          </div>
        </section>
      )}
    </AppShell>
  );
}
