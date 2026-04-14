-- ============================================
-- 🗄️ Schema PostgreSQL - WebCAD Antincendio
-- ============================================
-- Da eseguire nella console SQL di Supabase.
-- Crea tutte le tabelle, gli enum e le policy RLS
-- come definito nel PRD (Sezione 3).
-- ============================================

-- Abilita l'estensione UUID se non già attiva
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE element_type AS ENUM ('wall', 'duct', 'ceiling');
CREATE TYPE structural_point_type AS ENUM ('stud', 'pendant');

-- ============================================
-- TABELLA: projects
-- ============================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  client_info JSONB DEFAULT '{}',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE projects IS 'Progetti antincendio. Ogni progetto appartiene a un utente.';

-- ============================================
-- TABELLA: levels (gestione multi-piano)
-- ============================================

CREATE TABLE levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'Piano',
  elevation_z FLOAT NOT NULL DEFAULT 0,
  scale_ratio FLOAT,
  plan_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE levels IS 'Livelli/piani di un progetto. Ogni livello ha una propria planimetria e scala di calibrazione.';

-- ============================================
-- TABELLA: elements_master (geometria immutabile)
-- ============================================

CREATE TABLE elements_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  type element_type NOT NULL,
  total_length FLOAT NOT NULL DEFAULT 0,
  thickness FLOAT NOT NULL DEFAULT 0,
  geometry JSONB NOT NULL DEFAULT '{}',
  structural_settings JSONB DEFAULT '{"pitch": 600, "double_stud": false}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE elements_master IS 'Elementi strutturali master (muri, canali, controsoffitti) con geometria Konva.';

-- ============================================
-- TABELLA: openings_details (varchi e passaggi)
-- ============================================

CREATE TABLE openings_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  element_master_id UUID NOT NULL REFERENCES elements_master(id) ON DELETE CASCADE,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  dist_floor FLOAT NOT NULL DEFAULT 0,
  dist_start_node FLOAT NOT NULL DEFAULT 0
);

COMMENT ON TABLE openings_details IS 'Aperture/varchi negli elementi master (porte, finestre, passaggi impiantistici).';

-- ============================================
-- TABELLA: element_components (pezzi tagliati)
-- ============================================

CREATE TABLE element_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id UUID NOT NULL REFERENCES elements_master(id) ON DELETE CASCADE,
  cut_length FLOAT NOT NULL,
  cut_width FLOAT NOT NULL,
  sequence_index INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE element_components IS 'Componenti tagliati per la produzione. Generati dal motore di nesting.';

-- ============================================
-- TABELLA: structural_points (montanti/pendini)
-- ============================================

CREATE TABLE structural_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id UUID NOT NULL REFERENCES elements_master(id) ON DELETE CASCADE,
  type structural_point_type NOT NULL,
  offset_x FLOAT NOT NULL DEFAULT 0,
  offset_y FLOAT NOT NULL DEFAULT 0,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE structural_points IS 'Punti strutturali (montanti, pendini) calcolati dall''algoritmo Auto-Pitch o posizionati manualmente.';

-- ============================================
-- INDICI per performance
-- ============================================

CREATE INDEX idx_levels_project ON levels(project_id);
CREATE INDEX idx_elements_level ON elements_master(level_id);
CREATE INDEX idx_elements_type ON elements_master(type);
CREATE INDEX idx_openings_element ON openings_details(element_master_id);
CREATE INDEX idx_components_master ON element_components(master_id);
CREATE INDEX idx_structural_master ON structural_points(master_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Isolamento multi-tenant
-- ============================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE openings_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE element_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE structural_points ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti vedono solo i propri progetti
CREATE POLICY "Gli utenti vedono solo i propri progetti"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: accesso ai livelli tramite il progetto di appartenenza
CREATE POLICY "Accesso livelli tramite progetto"
  ON levels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = levels.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = levels.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: accesso elementi tramite livello -> progetto
CREATE POLICY "Accesso elementi tramite progetto"
  ON elements_master FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM levels
      JOIN projects ON projects.id = levels.project_id
      WHERE levels.id = elements_master.level_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM levels
      JOIN projects ON projects.id = levels.project_id
      WHERE levels.id = elements_master.level_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: accesso aperture tramite elemento -> livello -> progetto
CREATE POLICY "Accesso aperture tramite progetto"
  ON openings_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = openings_details.element_master_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = openings_details.element_master_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: accesso componenti tramite elemento -> livello -> progetto
CREATE POLICY "Accesso componenti tramite progetto"
  ON element_components FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = element_components.master_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = element_components.master_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: accesso punti strutturali tramite elemento -> livello -> progetto
CREATE POLICY "Accesso punti strutturali tramite progetto"
  ON structural_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = structural_points.master_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM elements_master
      JOIN levels ON levels.id = elements_master.level_id
      JOIN projects ON projects.id = levels.project_id
      WHERE elements_master.id = structural_points.master_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNZIONE: aggiornamento automatico updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ✅ Schema completato con successo!
-- ============================================
