
-- 1. Invite code on organizations
ALTER TABLE public.organizations
  ADD COLUMN invite_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex') UNIQUE;

-- 2. user_roles: allow owners/supervisors to insert + delete; users can delete own
CREATE POLICY "owners and supervisors add roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), organization_id, 'owner')
    OR public.has_role(auth.uid(), organization_id, 'supervisor')
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "owners and supervisors remove roles" ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), organization_id, 'owner')
    OR public.has_role(auth.uid(), organization_id, 'supervisor')
    OR user_id = auth.uid()
  );

CREATE POLICY "owners change roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'));
