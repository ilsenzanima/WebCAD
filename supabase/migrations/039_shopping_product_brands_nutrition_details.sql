-- Completa i dati recuperabili da Open Food/Beauty/Products Facts: valori
-- nutrizionali per 100g/porzione, etichette (bio, vegano...), additivi,
-- tracce di allergeni, formato confezione, categoria e foto confezione.
-- I valori nutrizionali sono eterogenei per tipo di prodotto (alimenti vs
-- cosmetici) percio' li teniamo in un unico campo jsonb invece di tante
-- colonne fisse.

ALTER TABLE public.shopping_product_brands
  ADD COLUMN IF NOT EXISTS nutriments JSONB,
  ADD COLUMN IF NOT EXISTS additives TEXT,
  ADD COLUMN IF NOT EXISTS traces TEXT,
  ADD COLUMN IF NOT EXISTS labels TEXT,
  ADD COLUMN IF NOT EXISTS package_quantity TEXT,
  ADD COLUMN IF NOT EXISTS off_categories TEXT,
  ADD COLUMN IF NOT EXISTS image_packaging_url TEXT;

COMMENT ON COLUMN public.shopping_product_brands.nutriments IS 'Valori nutrizionali per 100g/100ml e per porzione, da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.additives IS 'Additivi (numeri E) segnalati, da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.traces IS 'Possibili tracce di allergeni, da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.labels IS 'Etichette (bio, vegano, senza glutine...), da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.package_quantity IS 'Formato/quantita'' della confezione (es. "500 g"), da Open Food/Beauty/Products Facts.';
COMMENT ON COLUMN public.shopping_product_brands.off_categories IS 'Categoria merceologica secondo Open Food/Beauty/Products Facts (informativa, distinta dalla categoria interna del prodotto).';
COMMENT ON COLUMN public.shopping_product_brands.image_packaging_url IS 'Foto della confezione/etichetta, da Open Food/Beauty/Products Facts.';
