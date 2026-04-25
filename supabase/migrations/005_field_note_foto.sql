-- ============================================
-- 005: Aggiunta 'foto' a field_note_item_type
-- ============================================

-- In PostgreSQL per aggiungere un valore a un ENUM:
ALTER TYPE field_note_item_type ADD VALUE IF NOT EXISTS 'foto';
