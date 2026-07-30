-- Budget mensile impostabile direttamente su una categoria (es. "Utenze: 300
-- euro di media"), da confrontare con la somma di TUTTE le spese reali di
-- quella categoria nel mese, indipendentemente da quante singole voci di
-- budget/fornitori la compongono. Null = nessun limite impostato.
alter table public.expense_categories
  add column if not exists monthly_budget numeric(12, 2);
