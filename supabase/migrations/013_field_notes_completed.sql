-- ============================================
-- 013: Aggiunta colonna completed a field_notes
-- ============================================
-- Aggiunge lo stato di completamento per ogni singola nota/appunto

ALTER TABLE field_notes
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

COMMENT ON COLUMN field_notes.completed IS 'Indica se il singolo appunto/rilievo/disegno è stato contrassegnato come completato.';
