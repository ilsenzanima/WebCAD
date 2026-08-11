-- Vetrina prodotti riutilizzabile e lista della spesa condivisa con tutta la
-- famiglia: chiunque sia registrato in family_members ha accesso completo a
-- queste tabelle (e' pensata per essere aperta e modificata insieme mentre
-- si fa la spesa, non e' un dato privato come le Finanze).

CREATE TABLE public.shopping_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  category VARCHAR(60),
  default_store VARCHAR(100),
  aisle VARCHAR(100),
  default_unit VARCHAR(20),
  shelf_life_days INTEGER, -- durata tipica in giorni da quando viene acquistato (prodotti freschi); NULL = non tracciato
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

COMMENT ON TABLE public.shopping_products IS 'Vetrina di prodotti riutilizzabili per la lista della spesa di famiglia.';

CREATE TABLE public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'Lista della spesa',
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  shopping_date DATE,
  store VARCHAR(100),
  total_amount NUMERIC(10, 2),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.shopping_lists IS 'Sessioni di lista della spesa condivise dalla famiglia.';

CREATE TABLE public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shopping_products(id) ON DELETE CASCADE,
  quantity NUMERIC(10, 2),
  unit VARCHAR(20),
  price NUMERIC(10, 2),
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  expiry_date DATE, -- calcolata alla spunta: data spesa + shelf_life_days del prodotto
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.shopping_list_items IS 'Voci di una lista della spesa, collegate alla vetrina prodotti.';

CREATE INDEX idx_shopping_list_items_list ON public.shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_product ON public.shopping_list_items(product_id);

ALTER TABLE public.shopping_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_products_all" ON public.shopping_products
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "shopping_lists_all" ON public.shopping_lists
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "shopping_list_items_all" ON public.shopping_list_items
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));
