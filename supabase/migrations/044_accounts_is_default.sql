-- Conto predefinito: usato per precompilare la selezione conto quando si
-- registra una nuova spesa/entrata (e quando si salda una scadenza). Un
-- solo conto predefinito per utente.
ALTER TABLE public.accounts ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX accounts_one_default_per_user ON public.accounts(user_id) WHERE is_default;
