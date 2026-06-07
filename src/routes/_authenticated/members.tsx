import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getMyContext } from "@/lib/profile.functions";
import {
  listMembers,
  regenerateInviteCode,
  removeMember,
  changeMemberRole,
} from "@/lib/members.functions";
import { languageLabel } from "@/lib/languages";

export const Route = createFileRoute("/_authenticated/members")({
  component: MembersPage,
});

function MembersPage() {
  const fetchMe = useServerFn(getMyContext);
  const fetchMembers = useServerFn(listMembers);
  const regenerate = useServerFn(regenerateInviteCode);
  const remove = useServerFn(removeMember);
  const changeRole = useServerFn(changeMemberRole);
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers() });

  const me = meQ.data;
  const org = me?.organization;
  const isOwner = !!me?.roles?.some((r) => r.role === "owner");
  const isManager = !!me?.roles?.some((r) => r.role === "owner" || r.role === "supervisor");

  async function copyCode() {
    if (!org?.invite_code) return;
    await navigator.clipboard.writeText(org.invite_code);
    toast.success("Invite code copied");
  }

  async function handleRegenerate() {
    try {
      await regenerate();
      toast.success("New invite code generated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    try {
      await remove({ data: { userId } });
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRoleChange(userId: string, role: "owner" | "supervisor" | "worker") {
    try {
      await changeRole({ data: { userId, role } });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!org) {
    return (
      <AppShell title="Members">
        <p className="text-muted-foreground">You're not in an organization yet.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Team members" subtitle={org.name}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
      </div>

      {isManager && (
        <div className="mb-8 rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold">Invite code</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share this code with new team members. They can join from the welcome screen.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input readOnly value={org.invite_code ?? ""} className="max-w-xs font-mono" />
            <Button variant="outline" size="sm" onClick={copyCode} className="gap-2">
              <Copy className="h-4 w-4" /> Copy
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Members ({membersQ.data?.members.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {membersQ.isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {membersQ.data?.members.map((m) => {
            const isOrgOwner = m.id === org.owner_id;
            const isSelf = m.id === me?.profile?.id;
            const primaryRole = (m.roles[0] ?? "worker") as "owner" | "supervisor" | "worker";
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <div className="font-medium">
                    {m.full_name ?? "Unnamed"}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{languageLabel(m.preferred_language)}</span>
                    {m.skills.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{m.skills.join(", ")}</span>
                      </>
                    )}
                    <Badge variant={m.availability ? "default" : "secondary"} className="ml-1">
                      {m.availability ? "Available" : "Off"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && !isOrgOwner ? (
                    <Select
                      value={primaryRole}
                      onValueChange={(v) => handleRoleChange(m.id, v as "owner" | "supervisor" | "worker")}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{primaryRole}</Badge>
                  )}
                  {isManager && !isOrgOwner && !isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(m.id, m.full_name ?? "this member")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {membersQ.data?.members.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No members yet.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
