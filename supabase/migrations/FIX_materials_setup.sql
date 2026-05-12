-- ============================================================
-- FIX: Setup completo tabella materials per Supabase
-- Da incollare nella console SQL di Supabase (SQL Editor)
-- Usa IF NOT EXISTS per essere idempotente (sicuro da rieseguire)
-- ============================================================

-- STEP 1: Funzione updated_at (necessaria prima del trigger)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- STEP 2: Tabella materials
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  length_mm FLOAT,
  width_mm FLOAT,
  thickness_mm FLOAT,
  unit_cost DECIMAL(10, 4),
  unit VARCHAR(20) DEFAULT 'pz',
  stock_qty INTEGER DEFAULT 0,
  supplier VARCHAR(255),
  sku VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE materials IS 'Catalogo materiali da magazzino con dimensioni L x W x T.';

-- STEP 3: Indici
CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(is_active);

-- STEP 4: RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Rimuovi policy esistente se c'è (per evitare duplicati)
DROP POLICY IF EXISTS "Gli utenti gestiscono solo i propri materiali" ON materials;

CREATE POLICY "Gli utenti gestiscono solo i propri materiali"
  ON materials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- STEP 5: Trigger updated_at
DROP TRIGGER IF EXISTS update_materials_updated_at ON materials;

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- STEP 6: Verifica finale (deve restituire la tabella)
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'materials';
