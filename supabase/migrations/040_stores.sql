-- Negozi condivisi con tutta la famiglia (come vetrina/lista della spesa):
-- sostituiscono il testo libero "negozio" usato finora in vetrina e lista
-- della spesa con un vero elenco, con categoria e tessera fedelta'. Un
-- Fornitore (privato, solo Finanze) puo' facoltativamente collegarsi a un
-- Negozio per vedere il totale spese in quel negozio senza esporre le
-- Finanze al resto della famiglia.

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  address VARCHAR(200),
  loyalty_card_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.stores IS 'Negozi condivisi dalla famiglia, usati da vetrina/lista della spesa e opzionalmente collegati ai Fornitori in Finanze.';

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_all" ON public.stores
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

-- Migra i valori testo libero gia' presenti in vetrina/lista della spesa in
-- righe della nuova tabella (dedup case-insensitive), poi ricollega le
-- tabelle esistenti con una FK al posto del vecchio testo libero.
INSERT INTO public.stores (name, created_by)
SELECT DISTINCT ON (LOWER(TRIM(default_store))) TRIM(default_store), created_by
FROM public.shopping_products
WHERE default_store IS NOT NULL AND TRIM(default_store) <> ''
ORDER BY LOWER(TRIM(default_store)), created_at ASC;

INSERT INTO public.stores (name, created_by)
SELECT DISTINCT ON (LOWER(TRIM(sl.store))) TRIM(sl.store), sl.created_by
FROM public.shopping_lists sl
WHERE sl.store IS NOT NULL AND TRIM(sl.store) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.stores s WHERE LOWER(s.name) = LOWER(TRIM(sl.store)))
ORDER BY LOWER(TRIM(sl.store)), sl.created_at ASC;

ALTER TABLE public.shopping_products ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
UPDATE public.shopping_products sp
SET store_id = s.id
FROM public.stores s
WHERE sp.default_store IS NOT NULL AND LOWER(TRIM(sp.default_store)) = LOWER(s.name);
ALTER TABLE public.shopping_products DROP COLUMN default_store;

ALTER TABLE public.shopping_lists ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
UPDATE public.shopping_lists sl
SET store_id = s.id
FROM public.stores s
WHERE sl.store IS NOT NULL AND LOWER(TRIM(sl.store)) = LOWER(s.name);
ALTER TABLE public.shopping_lists DROP COLUMN store;

-- Collegamento opzionale (privato, un fornitore alla volta) da un Fornitore
-- Finanze a un Negozio condiviso.
ALTER TABLE public.suppliers ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
