-- Giorno del mese in cui una voce di budget ricorrente e' fissata
-- (es. affitto il 5, stipendio il 27), utile come promemoria quando si
-- conferma il pagamento reale. Null = nessun giorno specifico indicato.
alter table public.budgets
  add column if not exists day_of_month int check (day_of_month between 1 and 31);

-- Collega una spesa/entrata reale alla voce di budget (previsione) da cui e'
-- stata confermata, cosi' da poter "confermare" una previsione mensile con
-- il prezzo/pagamento effettivo invece di reinserirla da zero, mantenendo
-- il collegamento tra previsto e reale.
alter table public.expenses
  add column if not exists budget_id uuid references public.budgets(id) on delete set null;

create index if not exists idx_expenses_budget_id on public.expenses(budget_id);
