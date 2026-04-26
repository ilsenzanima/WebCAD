-- ============================================
-- 007: Aggiunta tipo 'posizione' alle voci appunti
-- ============================================

ALTER TYPE field_note_item_type ADD VALUE IF NOT EXISTS 'posizione';
