-- Marca scelta per una voce della lista, quando il prodotto generico ha
-- piu' marche censite in vetrina (es. "Bibita gassata" -> Coca-Cola o
-- Pepsi). Facoltativa: una voce puo' restare senza marca specifica.
ALTER TABLE public.shopping_list_items ADD COLUMN brand_id UUID REFERENCES public.shopping_product_brands(id) ON DELETE SET NULL;
