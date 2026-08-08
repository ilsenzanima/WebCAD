-- ============================================
-- Flag "ripianificata" per le scadenze
-- ============================================
-- Traccia se una scadenza scaduta e non saldata e' stata spostata a una
-- nuova data col pulsante "Ripianifica" (pagina Scadenze), cosi' da poterla
-- segnalare con un banner dedicato ovunque compaia nella lista del Budget.

ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS was_rescheduled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_schedules.was_rescheduled IS 'true se la data di scadenza e'' stata spostata col pulsante "Ripianifica" dopo essere risultata scaduta e non saldata.';
