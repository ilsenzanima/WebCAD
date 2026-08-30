-- Traccia l'evento Google Calendar collegato a ciascuna spesa/entrata registrata, per poter
-- aggiornare (PATCH) l'evento esistente invece di crearne uno duplicato ad ogni sincronizzazione,
-- sullo stesso modello di payment_schedules.google_event_id (migrazione 015).

alter table public.expenses add column if not exists google_event_id text;
