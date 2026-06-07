import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "owner" | "supervisor" | "worker";

async function getCurrentOrg(
  supabase: ReturnType<typeof import("@supabase/supabase-js")["createClient"]> | any,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return profile?.organization_id as string | null;
}

async function assertManager(supabase: any, userId: string, orgId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  const allowed = (roles ?? []).some((r: { role: AppRole }) =>
    r.role === "owner" || r.role === "supervisor",
  );
  if (!allowed) throw new Error("Not allowed");
}

// List members of the current org (with their roles).
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getCurrentOrg(supabase, userId);
    if (!orgId) return { members: [] };

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_language, skills, availability")
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);

    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("organization_id", orgId);
    if (rolesErr) throw new Error(rolesErr.message);

    const byUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      byUser.set(r.user_id, arr);
    }

    const members = (profiles ?? []).map((p: {
      id: string;
      full_name: string | null;
      preferred_language: string;
      skills: string[];
      availability: boolean;
    }) => ({
      ...p,
      roles: byUser.get(p.id) ?? [],
    }));

    return { members };
  });

// Join an organization with an invite code.
const JoinInput = z.object({ inviteCode: z.string().min(4).max(64), role: z.enum(["supervisor", "worker"]) });
export const joinOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JoinInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("invite_code", data.inviteCode.trim())
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Invalid invite code");

    // Cannot join via RLS insert (requires existing owner/supervisor on the org).
    // Use admin client to add the role on behalf of the new member.
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, organization_id: org.id, role: data.role });
    if (roleErr && !/duplicate key/.test(roleErr.message)) throw new Error(roleErr.message);

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ organization_id: org.id })
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    return { organization: org };
  });

// Regenerate the invite code (owner only).
export const regenerateInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getCurrentOrg(supabase, userId);
    if (!orgId) throw new Error("No organization");

    const newCode = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data, error } = await supabase
      .from("organizations")
      .update({ invite_code: newCode })
      .eq("id", orgId)
      .select("invite_code")
      .single();
    if (error) throw new Error(error.message);
    return { inviteCode: data.invite_code };
  });

// Remove a member (owners/supervisors). Cannot remove the org owner.
const RemoveInput = z.object({ userId: z.string().uuid() });
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCurrentOrg(supabase, userId);
    if (!orgId) throw new Error("No organization");
    await assertManager(supabase, userId, orgId);

    const { data: org } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", orgId)
      .single();
    if (org?.owner_id === data.userId) throw new Error("Cannot remove the organization owner");

    const { error: roleErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("organization_id", orgId);
    if (roleErr) throw new Error(roleErr.message);

    // Clear org from profile (admin: target user is not the caller).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ organization_id: null })
      .eq("id", data.userId)
      .eq("organization_id", orgId);

    return { ok: true };
  });

// Change a member's role (owner only).
const ChangeRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "supervisor", "worker"]),
});
export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChangeRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getCurrentOrg(supabase, userId);
    if (!orgId) throw new Error("No organization");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId);
    if (!(roles ?? []).some((r: { role: AppRole }) => r.role === "owner")) {
      throw new Error("Only the owner can change roles");
    }

    // Replace existing roles for this user in this org.
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("organization_id", orgId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: data.userId, organization_id: orgId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

// Update my own profile (skills, language, availability, name).
const ProfileInput = z.object({
  fullName: z.string().min(1).max(120).optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  availability: z.boolean().optional(),
});
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      full_name?: string;
      preferred_language?: string;
      skills?: string[];
      availability?: boolean;
    } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.preferredLanguage !== undefined) patch.preferred_language = data.preferredLanguage;
    if (data.skills !== undefined) patch.skills = data.skills;
    if (data.availability !== undefined) patch.availability = data.availability;

    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
