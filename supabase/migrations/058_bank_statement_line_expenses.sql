-- Collegamento "molte spese = un movimento" (o viceversa), per i casi in cui
-- la banca accorpa in un unico addebito piu' scadenze/acquisti gia' registrati
-- separatamente (es. due rate di un finanziamento SDD, o piu' acquisti Amazon
-- ravvicinati). Tenuto separato da bank_statement_lines.matched_expense_id
-- (che resta il percorso semplice uno-a-uno, gia' usato ovunque) invece di
-- sostituirlo, per non dover riscrivere tutta la logica esistente: una riga
-- qui equivale, ai fini della riconciliazione, a un match confermato.

create table if not exists public.bank_statement_line_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (line_id, expense_id)
);

create index if not exists idx_bank_statement_line_expenses_line on public.bank_statement_line_expenses(line_id);
-- una spesa puo' far parte di un solo raggruppamento, come per matched_expense_id
create unique index if not exists idx_bank_statement_line_expenses_expense on public.bank_statement_line_expenses(expense_id);

alter table public.bank_statement_line_expenses enable row level security;

create policy "Users can view their own line expense groups"
  on public.bank_statement_line_expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own line expense groups"
  on public.bank_statement_line_expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own line expense groups"
  on public.bank_statement_line_expenses for delete
  using (auth.uid() = user_id);
