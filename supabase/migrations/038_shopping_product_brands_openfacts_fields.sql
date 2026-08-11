-- Campi aggiuntivi recuperabili da Open Food/Beauty/Products Facts oltre a
-- Nutri-Score e NOVA: impatto ambientale, foto prodotto, ingredienti e
-- allergeni, cosi' da doverli ricopiare a mano sempre meno spesso.

ALTER TABLE public.shopping_product_brands
  ADD COLUMN IF NOT EXISTS eco_score VARCHAR(1) CHECK (eco_score IN ('A', 'B', 'C', 'D', 'E')),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS ingredients_text TEXT,
  ADD COLUMN IF NOT EXISTS allergens TEXT;

COMMENT ON COLUMN public.shopping_product_brands.eco_score IS 'Eco-Score (A-E): impatto ambientale, copiato da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.image_url IS 'Foto del prodotto, da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.ingredients_text IS 'Lista ingredienti, da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.allergens IS 'Allergeni segnalati, da Open Food/Beauty/Products Facts.';
