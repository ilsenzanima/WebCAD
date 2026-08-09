-- Rimuove i residui della vecchia versione CAD/antincendio dell'app (planimetrie,
-- appunti di cantiere, numerazione progressiva), ormai completamente scollegati
-- dall'applicazione attuale ("Finanza Privata"): nessuna route, server action o
-- tipo TypeScript li referenzia piu'. Le tabelle vere e proprie (materials,
-- projects, levels, field_notes*) non esistono su questo database: sono
-- sopravvissuti solo il bucket Storage "plans" (con file reali caricati),
-- la funzione next_field_note_number e il tipo enum field_note_item_type.

-- Storage: elimina policy, oggetti e bucket "plans" (planimetrie/foto vecchie).
-- Include sia i nomi delle policy originali (migrazione 008) sia quelli
-- ristretti al proprietario introdotti dalla migrazione 028, nel caso
-- quest'ultima non fosse ancora stata applicata.
DROP POLICY IF EXISTS "Planimetrie visibili a tutti" ON storage.objects;
DROP POLICY IF EXISTS "Planimetrie visibili agli utenti autenticati" ON storage.objects;
DROP POLICY IF EXISTS "Planimetrie visibili al proprietario" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono caricare planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono aggiornare le proprie planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Il proprietario puo' aggiornare le proprie planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati possono eliminare le proprie planimetrie" ON storage.objects;
DROP POLICY IF EXISTS "Il proprietario puo' eliminare le proprie planimetrie" ON storage.objects;

-- NB: Supabase blocca la DELETE diretta su storage.objects/storage.buckets
-- via SQL (trigger storage.protect_delete) per evitare perdite accidentali:
-- il bucket "plans" e i suoi file vanno eliminati dalla dashboard
-- (Storage > bucket "plans" > seleziona tutto > Elimina, poi elimina il
-- bucket stesso) oppure tramite la Storage API, non da qui.

-- Funzione ed enum orfani della vecchia numerazione appunti di cantiere
-- (le tabelle a cui si appoggiavano non esistono piu' su questo database).
DROP FUNCTION IF EXISTS public.next_field_note_number(uuid);
DROP TYPE IF EXISTS public.field_note_item_type;
