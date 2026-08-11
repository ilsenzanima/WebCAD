-- Ogni prodotto della vetrina (es. "Latte") puo' avere piu' marche/varianti
-- (es. "Granarolo", "Parmalat"), ciascuna con la propria valutazione della
-- famiglia, indici nutrizionali riportati in etichetta e codice a barre per
-- ritrovarla rapidamente.

CREATE TABLE public.shopping_product_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shopping_products(id) ON DELETE CASCADE,
  brand_name VARCHAR(100) NOT NULL,
  barcode VARCHAR(64),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5), -- valutazione della famiglia (gusto/qualita'), non un indice ufficiale
  nutri_score VARCHAR(1) CHECK (nutri_score IN ('A', 'B', 'C', 'D', 'E')), -- copiato dall'etichetta
  nova_group SMALLINT CHECK (nova_group BETWEEN 1 AND 4), -- copiato dall'etichetta: livello di lavorazione (1=non lavorato, 4=ultra-processato)
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, brand_name)
);

COMMENT ON TABLE public.shopping_product_brands IS 'Marche/varianti di un prodotto della vetrina, con valutazione, indici nutrizionali ed eventuale codice a barre.';

CREATE INDEX idx_shopping_product_brands_product ON public.shopping_product_brands(product_id);
CREATE INDEX idx_shopping_product_brands_barcode ON public.shopping_product_brands(barcode) WHERE barcode IS NOT NULL;

ALTER TABLE public.shopping_product_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_product_brands_all" ON public.shopping_product_brands
  FOR ALL
  USING (public.is_family_member(auth.uid()))
  WITH CHECK (public.is_family_member(auth.uid()));
