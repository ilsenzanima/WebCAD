-- Le Scadenze diventano l'unico punto di ingresso per le previsioni di spesa (Bisogno/
-- Desiderio/Imprevisto ereditato dalla categoria): assorbono i campi che servivano solo
-- alle vecchie "voci di budget" per finanziamenti/mutui con una data di fine e per
-- distinguere un importo certo da uno stimato.
ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS end_month SMALLINT NULL CHECK (end_month IS NULL OR (end_month BETWEEN 1 AND 12)),
  ADD COLUMN IF NOT EXISTS end_year SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_schedules.end_month IS 'Mese (1-12) dell''ultima occorrenza, per scadenze ricorrenti con termine noto (es. fine di un finanziamento).';
COMMENT ON COLUMN public.payment_schedules.end_year IS 'Anno dell''ultima occorrenza, si usa insieme a end_month.';
COMMENT ON COLUMN public.payment_schedules.is_estimated IS 'true se l''importo e'' una stima e non un valore certo.';

-- Il pulsante "Imprevisto" in Spese & Entrate: una spesa non pianificata puo' essere
-- marcata come imprevisto a prescindere dal tipo di default della sua categoria.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.expenses.is_emergency IS 'true se la spesa e'' stata segnata come imprevisto (non pianificato) al momento della registrazione, indipendentemente dal tipo della categoria.';
