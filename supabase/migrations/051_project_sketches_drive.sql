-- Backup su Google Drive dei disegni: il disegno resta modificabile nel
-- database (dati vettoriali in project_sketches.strokes), ma puo' anche
-- essere esportato come PNG su Drive (cartella Progetti/<Progetto>/Disegni),
-- tenendo traccia del file collegato per poterlo sovrascrivere invece di
-- accumulare copie ad ogni salvataggio.

ALTER TABLE public.project_sketches ADD COLUMN drive_file_id TEXT;
ALTER TABLE public.project_sketches ADD COLUMN drive_link TEXT;
ALTER TABLE public.project_sketches ADD COLUMN drive_synced_at TIMESTAMPTZ;
