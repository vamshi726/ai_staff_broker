import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mic, Languages, ListChecks, Users, UserCircle, Building2, KeyRound, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateOrganization } from "@/components/CreateOrganization";
import { JoinOrganization } from "@/components/JoinOrganization";
import { Button } from "@/components/ui/button";
import { getMyContext } from "@/lib/profile.functions";
import { listTasks, listMyTasks } from "@/lib/tasks.functions";
import { listMembers } from "@/lib/members.functions";
import { languageLabel } from "@/lib/languages";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fetchMe = useServerFn(getMyContext);
  const fetchTasks = useServerFn(listTasks);
  const fetchMyTasks = useServerFn(listMyTasks);
  const fetchMembers = useServerFn(listMembers);

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
  });
  const [onboardingMode, setOnboardingMode] = useState<"choose" | "create" | "join">("choose");

  const profile = data?.profile;
  const organization = data?.organization;
  const roles = data?.roles ?? [];
  const primaryRole = roles[0]?.role ?? (organization?.owner_id === profile?.id ? "owner" : "worker");
  const isManager = primaryRole === "owner" || primaryRole === "supervisor";

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    enabled: !!organization && isManager,
  });
  const myTasksQ = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => fetchMyTasks(),
    enabled: !!organization && !isManager,
  });
  const membersQ = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(),
    enabled: !!organization,
  });

  useTasksRealtime(organization?.id);

  if (isLoading) {
    return (
      <AppShell title="Loading…">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </AppShell>
    );
  }

  if (!organization) {
    return (
      <AppShell
        title={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ""}`}
        subtitle="Get started by creating an organization or joining one with a code."
      >
        {onboardingMode === "choose" && (
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            <button
              onClick={() => setOnboardingMode("create")}
              className="rounded-xl border bg-card p-8 text-left transition hover:border-primary hover:shadow-sm"
            >
              <Building2 className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Create an organization</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up your business and invite your team.
              </p>
            </button>
            <button
              onClick={() => setOnboardingMode("join")}
              className="rounded-xl border bg-card p-8 text-left transition hover:border-primary hover:shadow-sm"
            >
              <KeyRound className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Join with invite code</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Already have a code from your owner or supervisor? Use it here.
              </p>
            </button>
          </div>
        )}
        {onboardingMode === "create" && (
          <>
            <CreateOrganization />
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={() => setOnboardingMode("choose")}>
                Back
              </Button>
            </div>
          </>
        )}
        {onboardingMode === "join" && (
          <>
            <JoinOrganization />
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={() => setOnboardingMode("choose")}>
                Back
              </Button>
            </div>
          </>
        )}
      </AppShell>
    );
  }


  const activeTasks = (isManager ? tasksQ.data?.tasks : myTasksQ.data?.tasks ?? [])?.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled",
  ) ?? [];
  const members = membersQ.data?.members ?? [];
  const workerCount = members.filter((m) => m.roles.includes("worker")).length;
  const languageCount = new Set(members.map((m) => m.preferred_language)).size;

  return (
    <AppShell
      title={organization.name}
      subtitle={`Default language · ${languageLabel(organization.default_language)}`}
      roleBadge={primaryRole.toUpperCase()}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {isManager && (
          <Button asChild size="sm" className="gap-2">
            <Link to="/tasks"><Mic className="h-4 w-4" /> Voice & tasks</Link>
          </Button>
        )}
        {!isManager && (
          <Button asChild size="sm" className="gap-2">
            <Link to="/my-tasks"><ClipboardList className="h-4 w-4" /> My tasks</Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/members"><Users className="h-4 w-4" /> Members</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/profile"><UserCircle className="h-4 w-4" /> My profile</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ListChecks} label="Active tasks" value={String(activeTasks.length)} />
        <StatCard icon={Mic} label="My role" value={primaryRole} />
        <StatCard icon={Users} label="Workers" value={String(workerCount)} />
        <StatCard icon={Languages} label="Languages" value={String(languageCount || 1)} />
      </div>

      <section className="mt-10 rounded-xl border bg-card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
          <Mic className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">
          {isManager ? "Speak an instruction" : "Open My tasks to see what's assigned"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {isManager
            ? "Tap Voice & tasks to record an instruction in your language. The AI breaks it into tasks, assigns the right workers, and translates each task into their language with audio playback."
            : "Tasks assigned to you are translated to your preferred language and read aloud when you tap Play."}
        </p>
      </section>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
