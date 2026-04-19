-- Aggiungiamo un campo "notes" testuale alla tabella "projects"
-- per memorizzare gli appunti dell'utente.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Possiamo aggiornare un commento per chiarire
COMMENT ON COLUMN projects.notes IS 'Note editabili collegate al progetto (autosave)';
