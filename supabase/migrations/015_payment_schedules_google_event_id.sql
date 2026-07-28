-- Traccia l'evento Google Calendar collegato a ciascuna scadenza, per poter
-- aggiornare (PATCH) l'evento esistente invece di crearne uno duplicato
-- ad ogni sincronizzazione.

alter table public.payment_schedules add column if not exists google_event_id text;
