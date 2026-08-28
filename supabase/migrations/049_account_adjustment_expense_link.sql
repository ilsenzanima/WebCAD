-- Collega l'aggiornamento manuale del saldo alla spesa/entrata correttiva generata
-- automaticamente per riflettere la differenza anche lato Spese/Report/Budget.
-- Se l'aggiustamento viene cancellato, la spesa correttiva collegata sparisce con lui;
-- se invece e' la spesa a essere cancellata (es. dall'utente in Spese), l'aggiustamento
-- resta ma perde il collegamento.

alter table public.account_balance_adjustments
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;
