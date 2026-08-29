-- Riconciliazione con l'estratto conto: import dei movimenti bancari (CSV) e
-- abbinamento alle spese/entrate gia' registrate. I fornitori possono avere piu'
-- di un codice identificativo (es. terminali POS di sedi diverse dello stesso
-- supermercato, o l'IBAN per i bonifici): un codice nuovo mai visto va collegato
-- manualmente una volta, dopodiche' i movimenti successivi con lo stesso codice
-- si abbinano da soli.

create table if not exists public.supplier_account_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  code text not null, -- codice terminale POS o IBAN cosi' come compare nella descrizione dell'estratto conto
  label text, -- etichetta opzionale per riconoscerlo (es. "Cassa Via Verdi")
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists idx_supplier_account_codes_supplier on public.supplier_account_codes(supplier_id);

alter table public.supplier_account_codes enable row level security;

create policy "Users can view their own supplier account codes"
  on public.supplier_account_codes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own supplier account codes"
  on public.supplier_account_codes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own supplier account codes"
  on public.supplier_account_codes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own supplier account codes"
  on public.supplier_account_codes for delete
  using (auth.uid() = user_id);

-- Un import = un file di movimenti caricato per un conto. Tiene traccia di
-- quando e' avvenuto e di quante righe conteneva, cosi' da poter mostrare lo
-- storico e cancellare un import sbagliato insieme a tutte le sue righe.
create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  file_name text,
  period_start date,
  period_end date,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bank_statement_imports_account on public.bank_statement_imports(account_id);

alter table public.bank_statement_imports enable row level security;

create policy "Users can view their own statement imports"
  on public.bank_statement_imports for select
  using (auth.uid() = user_id);

create policy "Users can insert their own statement imports"
  on public.bank_statement_imports for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own statement imports"
  on public.bank_statement_imports for delete
  using (auth.uid() = user_id);

-- Singolo movimento letto dal file. "transaction_date" e' la data di
-- contabilizzazione (colonna "Data"), "value_date" la data valuta (colonna
-- "Valuta"): quest'ultima e' quella da usare per il confronto con la data della
-- spesa registrata, visto che i pagamenti POS vengono spesso contabilizzati con
-- qualche giorno di ritardo rispetto al momento reale della spesa.
-- "detected_code" e' il codice (terminale POS o IBAN) estratto dalla
-- descrizione, usato per risalire al fornitore tramite supplier_account_codes.
-- "matched_expense_id" viene valorizzato sia dal match automatico (importo e
-- data coincidenti entro tolleranza) sia dalla conferma manuale dell'utente;
-- "is_ignored" e' per i movimenti che l'utente ha scelto di non collegare a
-- nessuna spesa (es. una commissione che non vuole tracciare).
create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  transaction_date date not null,
  value_date date not null,
  amount numeric not null,
  type text, -- tipologia cosi' come indicata dalla banca (es. "Pagamenti", "Commissioni", "Bonifici e trasferimenti")
  description text not null,
  detected_code text,
  matched_expense_id uuid references public.expenses(id) on delete set null,
  is_ignored boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_bank_statement_lines_import on public.bank_statement_lines(import_id);
create index if not exists idx_bank_statement_lines_account on public.bank_statement_lines(account_id);
create index if not exists idx_bank_statement_lines_value_date on public.bank_statement_lines(value_date);
create index if not exists idx_bank_statement_lines_detected_code on public.bank_statement_lines(detected_code);
-- una spesa puo' essere collegata al massimo a un movimento bancario
create unique index if not exists idx_bank_statement_lines_matched_expense on public.bank_statement_lines(matched_expense_id) where matched_expense_id is not null;

alter table public.bank_statement_lines enable row level security;

create policy "Users can view their own statement lines"
  on public.bank_statement_lines for select
  using (auth.uid() = user_id);

create policy "Users can insert their own statement lines"
  on public.bank_statement_lines for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own statement lines"
  on public.bank_statement_lines for update
  using (auth.uid() = user_id);

create policy "Users can delete their own statement lines"
  on public.bank_statement_lines for delete
  using (auth.uid() = user_id);
