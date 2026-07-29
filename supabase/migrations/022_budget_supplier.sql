-- Fornitore preimpostato su una voce di budget (previsione), cosi' che quando
-- si conferma il pagamento reale (expenses.budget_id) il fornitore venga
-- ereditato automaticamente invece di doverlo scegliere ogni volta.
alter table public.budgets
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
