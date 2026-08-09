-- Isola i file del bucket "plans" per proprietario: la policy SELECT
-- precedente (migrazione 008) permetteva a qualsiasi utente autenticato di
-- elencare i file di TUTTI gli utenti (nome file, owner) tramite
-- storage.objects, e le policy UPDATE/DELETE non controllavano affatto il
-- proprietario, permettendo a un utente autenticato di modificare o
-- cancellare le planimetrie di un altro utente. Il download resta pubblico
-- tramite URL diretto (bucket "plans" e' public=true), solo l'accesso via
-- query a storage.objects viene ristretto al proprietario.

DROP POLICY IF EXISTS "Planimetrie visibili agli utenti autenticati" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono aggiornare le proprie planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono eliminare le proprie planimetrie" ON storage.objects;

CREATE POLICY "Planimetrie visibili al proprietario"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plans' AND owner = auth.uid());

CREATE POLICY "Il proprietario puo' aggiornare le proprie planimetrie"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'plans' AND owner = auth.uid())
WITH CHECK (bucket_id = 'plans' AND owner = auth.uid());

CREATE POLICY "Il proprietario puo' eliminare le proprie planimetrie"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plans' AND owner = auth.uid());

-- La funzione next_field_note_number ha gia' un controllo interno che blocca
-- chi non e' il proprietario (auth.uid() != p_user_id), ma il ruolo "anon"
-- risultava comunque avere il permesso EXECUTE (concesso di default da
-- Supabase alla creazione della funzione; la REVOKE ... FROM PUBLIC della
-- migrazione 003 non rimuove i permessi espliciti gia' assegnati ad anon).
-- Chiudiamo esplicitamente la superficie anche se non sfruttabile.
REVOKE EXECUTE ON FUNCTION public.next_field_note_number(UUID) FROM anon;
