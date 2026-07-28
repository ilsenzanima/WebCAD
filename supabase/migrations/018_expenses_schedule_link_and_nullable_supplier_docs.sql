-- Fase 2 (unificazione Spese/Entrate/Scadenze):
-- 1) supplier_documents.supplier_id diventa opzionale per permettere allegati
--    su una singola spesa/entrata senza doverla per forza legare a un fornitore.
-- 2) expenses.schedule_id traccia la scadenza di origine quando una spesa
--    viene generata pagando una scadenza (prima non c'era alcun collegamento).

alter table public.supplier_documents alter column supplier_id drop not null;

alter table public.expenses
  add column if not exists schedule_id uuid references public.payment_schedules(id) on delete set null;
