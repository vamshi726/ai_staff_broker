
ALTER TABLE public.tasks
  ADD COLUMN target_language TEXT,
  ADD COLUMN translated_title TEXT,
  ADD COLUMN translated_description TEXT,
  ADD COLUMN translated_audio_url TEXT;

-- Storage policies on voice bucket. Paths are "<org_id>/<filename>".
CREATE POLICY "org members read voice files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice'
    AND public.is_org_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "org members upload voice files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice'
    AND public.is_org_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
