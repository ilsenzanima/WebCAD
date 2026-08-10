-- Periodo di copertura/competenza della bolletta (es. "Marzo 2026" o "Gennaio-Marzo 2026"
-- per le bollette trimestrali): memorizzato come primo giorno del mese di inizio/fine.
-- period_end = period_start per un singolo mese; period_end successivo per un periodo
-- di piu' mesi. Vive solo su expenses (come consumption_value) perche' si registra nello
-- stesso momento in cui la spesa viene creata (direttamente o saldando una scadenza).

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS period_start DATE NULL,
  ADD COLUMN IF NOT EXISTS period_end DATE NULL;

COMMENT ON COLUMN public.expenses.period_start IS 'Primo giorno del mese di inizio del periodo di copertura della bolletta (se applicabile).';
COMMENT ON COLUMN public.expenses.period_end IS 'Primo giorno del mese di fine del periodo di copertura della bolletta; uguale a period_start per bollette di un solo mese.';
