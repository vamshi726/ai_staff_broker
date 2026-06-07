import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyContext } from "@/lib/profile.functions";
import { updateMyProfile } from "@/lib/members.functions";
import { LANGUAGES } from "@/lib/languages";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const fetchMe = useServerFn(getMyContext);
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState("en");
  const [availability, setAvailability] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = meQ.data?.profile;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setLanguage(p.preferred_language ?? "en");
    setAvailability(p.availability);
    setSkills(p.skills ?? []);
  }, [meQ.data?.profile?.id]);

  function addSkill() {
    const v = skillInput.trim();
    if (!v || skills.includes(v) || skills.length >= 20) return;
    setSkills([...skills, v]);
    setSkillInput("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await update({
        data: { fullName, preferredLanguage: language, availability, skills },
      });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Your profile" subtitle="Tell the team what you do and how to reach you.">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
      </div>
      <div className="max-w-xl space-y-6 rounded-xl border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lang">Preferred language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="lang"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Instructions are translated into this language for you.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Skills</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. inventory, billing, delivery"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addSkill} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {skills.length === 0 && <span className="text-xs text-muted-foreground">No skills added.</span>}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="avail" className="text-sm">Available for tasks</Label>
            <p className="text-xs text-muted-foreground">Turn off when you're unavailable.</p>
          </div>
          <Switch id="avail" checked={availability} onCheckedChange={setAvailability} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </AppShell>
  );
}
