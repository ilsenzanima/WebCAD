-- ============================================
-- 006: Aggiunta nuovi tipi di voce appunti
-- ============================================

ALTER TYPE field_note_item_type ADD VALUE IF NOT EXISTS 'dim_quadrata';
ALTER TYPE field_note_item_type ADD VALUE IF NOT EXISTS 'dim_cubica';

-- Eliminazione CASCADE: quando si elimina un progetto, si eliminano
-- a cascata levels → field_notes → field_note_items.
-- I vincoli dovrebbero già essere presenti, verifichiamo e aggiungiamo
-- esplicitamente la CASCADE su field_notes → projects se non c'è.

-- Ricrea il constraint con CASCADE (idempotente grazie a IF EXISTS)
ALTER TABLE field_notes
  DROP CONSTRAINT IF EXISTS field_notes_project_id_fkey;

ALTER TABLE field_notes
  ADD CONSTRAINT field_notes_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- Stessa cosa per field_note_items → field_notes (già dovrebbe esserci)
ALTER TABLE field_note_items
  DROP CONSTRAINT IF EXISTS field_note_items_note_id_fkey;

ALTER TABLE field_note_items
  ADD CONSTRAINT field_note_items_note_id_fkey
  FOREIGN KEY (note_id)
  REFERENCES field_notes(id)
  ON DELETE CASCADE;
