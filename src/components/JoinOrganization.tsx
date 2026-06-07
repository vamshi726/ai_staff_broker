import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { joinOrganization } from "@/lib/members.functions";

export function JoinOrganization() {
  const join = useServerFn(joinOrganization);
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"supervisor" | "worker">("worker");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await join({ data: { inviteCode: code.trim(), role } });
      toast.success("Joined organization");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
        <KeyRound className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Join an organization</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the invite code shared by your owner or supervisor.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
        <div className="space-y-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 4f2c8b1a..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Joining as</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "supervisor" | "worker")}>
            <SelectTrigger id="role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Joining..." : "Join organization"}
        </Button>
      </form>
    </div>
  );
}
