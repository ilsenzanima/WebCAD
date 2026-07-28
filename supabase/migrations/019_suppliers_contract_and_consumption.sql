-- Fase 3 (scheda Fornitori piu' utile):
-- 1) suppliers.is_utility + consumption_unit: marca un fornitore come utenza
--    (luce/gas/acqua) con l'unita' di misura del consumo (kWh, m3, ...).
-- 2) suppliers.is_active + contract_closed_at: stato del contratto
--    (in corso / chiuso), con data di chiusura opzionale.
-- 3) expenses.consumption_value: consumo del periodo registrato insieme
--    alla singola bolletta, per calcolare l'andamento e il costo per unita'.
-- 4) supplier_documents.doc_type: distingue Contratto / Bolletta / Altro
--    tra gli allegati gia' esistenti.

alter table public.suppliers
  add column if not exists is_utility boolean not null default false,
  add column if not exists consumption_unit text,
  add column if not exists is_active boolean not null default true,
  add column if not exists contract_closed_at date;

alter table public.expenses
  add column if not exists consumption_value numeric;

alter table public.supplier_documents
  add column if not exists doc_type text not null default 'altro';
