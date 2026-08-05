-- Collega una scadenza (payment_schedules) alla voce di budget da cui e'
-- stata generata, cosi' che una previsione ricorrente con un giorno del mese
-- fisso (es. Mutuo il 15) possa comparire come promemoria/scadenza da pagare
-- invece di dover essere ricordata e inserita a mano ogni mese.
alter table public.payment_schedules
  add column if not exists budget_id uuid references public.budgets(id) on delete set null;

create index if not exists idx_payment_schedules_budget_id on public.payment_schedules(budget_id);
