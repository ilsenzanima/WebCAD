-- Permette di annullare per errore il saldo di una scadenza (pulsante "Salda" cliccato per
-- sbaglio): serve un modo per ritrovare, e cancellare, l'occorrenza successiva che una scadenza
-- ricorrente genera automaticamente quando viene saldata, senza doverla individuare a tentativi
-- confrontando categoria/importo/data.
ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS generated_from_schedule_id UUID NULL REFERENCES public.payment_schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payment_schedules.generated_from_schedule_id IS 'Se questa riga e'' stata creata automaticamente saldando un''altra scadenza ricorrente, l''id di quella scadenza.';

CREATE INDEX IF NOT EXISTS idx_schedules_generated_from ON public.payment_schedules(generated_from_schedule_id);
