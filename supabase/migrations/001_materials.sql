-- ============================================
-- Aggiornamento Schema: Tabella materials
-- Epic 1: Catalogo Materiali da Magazzino
-- ============================================
-- Da eseguire nella console SQL di Supabase
-- DOPO lo schema principale (schema.sql)
-- ============================================

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),       -- es: 'profilo', 'lastra', 'tassello'
  length_mm FLOAT,             -- Lunghezza (L) in mm
  width_mm FLOAT,              -- Larghezza (W) in mm
  thickness_mm FLOAT,          -- Spessore (T) in mm
  unit_cost DECIMAL(10, 4),    -- Costo unitario
  unit VARCHAR(20) DEFAULT 'pz', -- Unità misura: pz, ml, mq
  stock_qty INTEGER DEFAULT 0, -- Giacenza
  supplier VARCHAR(255),       -- Fornitore
  sku VARCHAR(100),            -- Codice articolo
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE materials IS 'Catalogo materiali da magazzino con dimensioni L x W x T per il motore di nesting.';

CREATE INDEX idx_materials_user ON materials(user_id);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_active ON materials(is_active);

-- RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gli utenti gestiscono solo i propri materiali"
  ON materials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
