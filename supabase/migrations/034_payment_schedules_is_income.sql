-- Le Scadenze diventano anche il punto di ingresso per le entrate ricorrenti (es. stipendio),
-- cosi' come gia' lo sono per le uscite: un impegno di entrata si registra una volta sola qui
-- e si proietta da solo nei mesi successivi, invece di doverlo reinserire a mano anche come
-- voce di budget separata.
ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS is_income BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_schedules.is_income IS 'true per un impegno ricorrente di entrata (es. stipendio), false (default) per un''uscita.';
