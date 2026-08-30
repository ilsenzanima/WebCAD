-- Un codice puo' essere "riconosciuto ma senza fornitore": l'utente ha visto il
-- movimento (es. un bonifico personale) e deciso che non e' un fornitore da
-- tracciare, ma non vuole che gli venga richiesto di nuovo ogni volta che
-- ricompare lo stesso codice. supplier_id null significa proprio questo.

alter table public.supplier_account_codes alter column supplier_id drop not null;
