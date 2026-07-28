-- Permette di indicare una scadenza (mese/anno di fine) per voci di budget
-- con durata limitata, es. un mutuo o un finanziamento gia in corso di cui
-- si conoscono le rate/mesi rimanenti. Null = voce ricorrente senza fine.

alter table public.budgets
  add column if not exists end_month int check (end_month between 1 and 12),
  add column if not exists end_year int;
