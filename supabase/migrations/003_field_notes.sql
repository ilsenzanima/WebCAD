-- ============================================
-- 003: Appunti di Cantiere (Field Notes)
-- ============================================
-- Tabelle per la gestione degli appunti presi in cantiere.
-- Ogni appunto ha un numero progressivo GLOBALE per utente,
-- un tipo (da catalogo), e un insieme di misure/voci.
-- ============================================

-- ============================================
-- TABELLA: field_note_types (catalogo tipi)
-- ============================================

CREATE TABLE IF NOT EXISTS field_note_types (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name      VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

COMMENT ON TABLE field_note_types IS 'Catalogo dei tipi di appunto configurabili dall''utente (es. Parete, Soffitto, Porta).';

ALTER TABLE field_note_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utente vede solo i propri tipi appunto"
  ON field_note_types FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SEQUENZA: numero progressivo globale per utente
-- ============================================
-- Usiamo una tabella di contatori per mantenere
-- il numero progressivo isolato per ogni utente.

CREATE TABLE IF NOT EXISTS field_note_counters (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_num  INT NOT NULL DEFAULT 0
);

ALTER TABLE field_note_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utente vede solo il proprio contatore"
  ON field_note_counters FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Funzione atomica per ottenere il prossimo numero
CREATE OR REPLACE FUNCTION next_field_note_number(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_num INT;
BEGIN
  INSERT INTO field_note_counters (user_id, last_num)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET last_num = field_note_counters.last_num + 1
  RETURNING last_num INTO v_num;
  RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABELLA: field_notes (gli appunti)
-- ============================================

CREATE TABLE IF NOT EXISTS field_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_number  INT NOT NULL,           -- progressivo globale per utente
  type_id      UUID REFERENCES field_note_types(id) ON DELETE SET NULL,
  type_name    VARCHAR(150),           -- snapshot del nome tipo al momento della creazione
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE field_notes IS 'Appunti di cantiere. note_number è progressivo globale per utente.';

CREATE INDEX IF NOT EXISTS idx_field_notes_project  ON field_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_field_notes_user     ON field_notes(user_id);

ALTER TABLE field_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utente vede solo i propri appunti"
  ON field_notes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_field_notes_updated_at
  BEFORE UPDATE ON field_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELLA: field_note_items (voci/misure)
-- ============================================

CREATE TYPE field_note_item_type AS ENUM (
  'base',        -- misura con unità (mm/cm)
  'altezza',     -- misura con unità (mm/cm)
  'spessore',    -- misura con unità (mm/cm)
  'lana_interna',-- solo spunta (boolean)
  'dipintura',   -- solo spunta (boolean)
  'nota'         -- testo libero
);

CREATE TABLE IF NOT EXISTS field_note_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id     UUID NOT NULL REFERENCES field_notes(id) ON DELETE CASCADE,
  item_type   field_note_item_type NOT NULL,
  value_num   FLOAT,          -- per le misure (base, altezza, spessore)
  value_unit  VARCHAR(5),     -- 'mm' | 'cm'
  value_bool  BOOLEAN,        -- per lana_interna, dipintura
  value_text  TEXT,           -- per nota libera
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE field_note_items IS 'Voci/misure di un appunto di cantiere.';

CREATE INDEX IF NOT EXISTS idx_field_note_items_note ON field_note_items(note_id);

ALTER TABLE field_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accesso voci tramite appunto"
  ON field_note_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM field_notes
      WHERE field_notes.id = field_note_items.note_id
        AND field_notes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM field_notes
      WHERE field_notes.id = field_note_items.note_id
        AND field_notes.user_id = auth.uid()
    )
  );

-- ============================================
-- ✅ Migrazione 003 completata!
-- ============================================
