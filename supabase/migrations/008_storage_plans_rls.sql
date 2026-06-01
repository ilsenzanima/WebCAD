-- ============================================
-- 008: RLS policy per bucket storage "plans"
-- ============================================

-- Crea il bucket se non esiste (in caso di nuovo ambiente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Elimina policy preesistenti per ricreazione pulita
DROP POLICY IF EXISTS "Utenti autenticati possono caricare planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Planimetrie visibili a tutti" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono aggiornare le proprie planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono eliminare le proprie planimetrie" ON storage.objects;

-- SELECT: solo utenti autenticati possono interrogare i file (il download tramite URL pubblico rimane attivo per tutti)
CREATE POLICY "Planimetrie visibili agli utenti autenticati"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plans');

-- INSERT: solo utenti autenticati possono caricare
CREATE POLICY "Utenti autenticati possono caricare planimetrie"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plans');

-- UPDATE: tutti gli utenti autenticati possono aggiornare file nel bucket plans
CREATE POLICY "Utenti autenticati possono aggiornare le proprie planimetrie"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'plans');

-- DELETE: tutti gli utenti autenticati possono eliminare file nel bucket plans
CREATE POLICY "Utenti autenticati possono eliminare le proprie planimetrie"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plans');
