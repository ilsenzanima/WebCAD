-- Eccezioni mensili per le voci di budget ricorrenti: permette di correggere
-- l'importo previsto di una voce (es. stipendio, sport bambini) per un mese
-- specifico senza alterare la proiezione degli altri mesi.

create table if not exists public.budget_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  amount numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, year, month)
);

alter table public.budget_overrides enable row level security;

create policy "Users can view their own budget overrides"
  on public.budget_overrides for select
  using (auth.uid() = user_id);

create policy "Users can insert their own budget overrides"
  on public.budget_overrides for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own budget overrides"
  on public.budget_overrides for update
  using (auth.uid() = user_id);

create policy "Users can delete their own budget overrides"
  on public.budget_overrides for delete
  using (auth.uid() = user_id);
