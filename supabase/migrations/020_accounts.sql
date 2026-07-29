-- Priorita' Media: concetto di "conto" con saldo reale, non solo il totale
-- entrate/uscite. Ogni spesa/entrata puo' essere collegata (facoltativo) a
-- un conto; il saldo corrente si calcola come:
-- initial_balance + entrate collegate - uscite collegate.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'checking',
  initial_balance numeric not null default 0,
  color text not null default 'sky',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Users can view their own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own accounts"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

alter table public.expenses
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
