-- Un'entrata puo' essere il rimborso di una spesa gia' registrata presso un fornitore
-- (es. reso di un acquisto, storno di una bolletta). In quel caso l'utente collega
-- l'entrata al fornitore (expenses.supplier_id, finora usato solo per le uscite) e la
-- marca con is_refund, cosi' nella scheda del fornitore spese e rimborsi si possono
-- confrontare per far quadrare i conti.

alter table public.expenses
  add column if not exists is_refund boolean not null default false;
