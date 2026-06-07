import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_language, skills, availability, organization_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("organization_id, role")
      .eq("user_id", userId);

    let organization = null;
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, default_language, owner_id, invite_code")
        .eq("id", profile.organization_id)
        .maybeSingle();
      organization = org;
    }

    return { profile, roles: roles ?? [], organization };
  });
