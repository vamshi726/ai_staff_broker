import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
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
import { createOrganization } from "@/lib/organizations.functions";
import { LANGUAGES } from "@/lib/languages";

export function CreateOrganization() {
  const create = useServerFn(createOrganization);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create({ data: { name, defaultLanguage: language } });
      toast.success("Organization created");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
        <Building2 className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Create your organization</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start by setting up your business. You can invite supervisors and workers next.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" required minLength={2} placeholder="e.g. Sri Lakshmi Supermarket" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-lang">Your spoken language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="org-lang"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create organization"}
        </Button>
      </form>
    </div>
  );
}
