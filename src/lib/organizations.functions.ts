import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateOrgInput = z.object({
  name: z.string().min(2).max(120),
  defaultLanguage: z.string().min(2).max(10),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateOrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: data.name,
        owner_id: userId,
        default_language: data.defaultLanguage,
      })
      .select()
      .single();

    if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create organization");

    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, organization_id: org.id, role: "owner" });
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ organization_id: org.id })
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    return { organization: org };
  });
