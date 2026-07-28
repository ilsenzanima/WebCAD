-- Tabella per la persistenza dei token OAuth di Google (Drive) per utente.
-- Necessaria per caricare i documenti fornitori direttamente su Google Drive
-- senza richiedere all'utente di ricollegare l'account ogni ora.

create table if not exists public.user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_google_tokens enable row level security;

create policy "Users can view their own google token"
  on public.user_google_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own google token"
  on public.user_google_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own google token"
  on public.user_google_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own google token"
  on public.user_google_tokens for delete
  using (auth.uid() = user_id);
