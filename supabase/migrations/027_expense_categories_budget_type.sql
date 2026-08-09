-- Classificazione Bisogno/Desiderio/Imprevisto per categoria, ai fini della
-- ripartizione 50/30/20: le spese reali non collegate a una specifica voce di
-- budget (che ha gia' un tipo proprio) vengono classificate tramite il tipo
-- della loro categoria invece di restare "non classificate".

ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS budget_type VARCHAR(20) NULL
    CHECK (budget_type IS NULL OR budget_type IN ('need', 'want', 'emergency'));

COMMENT ON COLUMN public.expense_categories.budget_type IS 'Classificazione Bisogno/Desiderio/Imprevisto della categoria, usata per assegnare la spesa reale non collegata a una voce di budget alla ripartizione 50/30/20.';
