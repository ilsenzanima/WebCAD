-- Fondamenta per l'accesso multi-utente della famiglia. Non serve un concetto
-- generico di "famiglia" (ce n'e' una sola): basta un elenco di chi puo'
-- accedere all'app e con quale ruolo. I dati finanziari restano protetti
-- dalle policy esistenti su user_id (ogni utente vede solo le proprie righe):
-- questa tabella serve solo a sapere chi e' admin (vede anche Finanze) e chi
-- e' un membro semplice (vede solo gli strumenti condivisi futuri).

CREATE TABLE public.family_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.family_members IS 'Chi puo'' accedere al gestionale di famiglia e con quale ruolo (admin vede anche Finanze, member no).';

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Chiunque sia gia' membro della famiglia puo' vedere l'elenco (serve per
-- mostrare i nomi negli strumenti condivisi futuri, es. a chi e' assegnato un compito).
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.family_members));

-- Solo un admin puo' aggiungere, modificare o rimuovere membri; un admin non
-- puo' rimuovere se stesso per errore (eviterebbe di restare senza admin).
CREATE POLICY "family_members_insert" ON public.family_members
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members WHERE role = 'admin'));

CREATE POLICY "family_members_update" ON public.family_members
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.family_members WHERE role = 'admin'));

CREATE POLICY "family_members_delete" ON public.family_members
  FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM public.family_members WHERE role = 'admin')
    AND user_id <> auth.uid()
  );

-- Registra il primo admin, cosi' le policy sopra hanno da subito una riga da cui partire.
INSERT INTO public.family_members (user_id, display_name, role)
SELECT id, COALESCE(NULLIF(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1)), 'admin'
FROM auth.users
WHERE email = 'a.dagostino@opifiresafe.com'
ON CONFLICT (user_id) DO NOTHING;
