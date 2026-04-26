-- Aggiunta voce 'materiale' agli appunti in cantiere
ALTER TYPE field_note_item_type ADD VALUE IF NOT EXISTS 'materiale';
