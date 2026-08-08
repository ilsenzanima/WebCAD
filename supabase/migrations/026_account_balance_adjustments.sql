-- Aggiornamenti manuali del saldo di un conto: l'utente segna il saldo reale
-- osservato (es. dall'app della banca) a una certa data, per assorbire spese
-- minori non registrate senza doverle cercare una per una. Il saldo corrente
-- si calcola a partire dall'aggiornamento piu' recente (data <= oggi), sommando
-- solo le entrate/uscite collegate al conto con data successiva a quella.

create table if not exists public.account_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null,
  balance numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_adjustments_account on public.account_balance_adjustments(account_id);
create index if not exists idx_account_adjustments_date on public.account_balance_adjustments(date);

alter table public.account_balance_adjustments enable row level security;

create policy "Users can view their own account adjustments"
  on public.account_balance_adjustments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own account adjustments"
  on public.account_balance_adjustments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own account adjustments"
  on public.account_balance_adjustments for delete
  using (auth.uid() = user_id);
