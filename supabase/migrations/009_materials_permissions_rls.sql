-- ============================================
-- Fix hardening: permessi e RLS per public.materials
-- Utile quando la tabella è stata creata manualmente senza policy/grant.
-- ============================================

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materials'
      AND policyname = 'Gli utenti gestiscono solo i propri materiali'
  ) THEN
    CREATE POLICY "Gli utenti gestiscono solo i propri materiali"
      ON public.materials
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.materials TO authenticated;
