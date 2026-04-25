-- ============================================
-- 004: Aggiunta level_id a field_notes
-- ============================================
-- Gli appunti vengono ora associati a un singolo
-- livello (piano 2D/3D) invece che solo al progetto.
-- La numerazione progressiva resta GLOBALE per utente.
-- ============================================

-- Aggiunge la colonna level_id (nullable per compatibilità backward)
ALTER TABLE field_notes
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES levels(id) ON DELETE CASCADE;

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_field_notes_level ON field_notes(level_id);

-- Aggiorna la RLS policy per garantire accesso
-- tramite level → project → utente
-- (la policy esistente rimane valida perché usa user_id direttamente)

COMMENT ON COLUMN field_notes.level_id IS 'Livello (piano 2D/3D) a cui appartiene l''appunto. Null = appunto generico del progetto (backward compat).';
