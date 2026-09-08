-- Elenco dei calendari Google secondari (oltre a quello dedicato) che l'utente ha scelto
-- di visualizzare in sola lettura nel Calendario Finanziario. Salviamo l'oggetto completo
-- {id, summary, backgroundColor} e non solo l'id, per evitare una chiamata a
-- calendarList.list ad ogni caricamento del calendario (basta lo storico gia' salvato qui).

alter table public.user_google_tokens
  add column if not exists selected_calendars jsonb not null default '[]'::jsonb;
