-- Evoluzione scheda progetto: stato (bozza/in corso/finito), un'unica nota
-- libera in stile "documento" (rimpiazza l'elenco di note separate) e una
-- lista materiali in stile foglio di calcolo, con prezzo totale/provvisorio.

ALTER TABLE public.projects ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza', 'in_corso', 'finito'));
ALTER TABLE public.projects ADD COLUMN notes_html TEXT;

DROP TABLE IF EXISTS public.project_notes;

CREATE TABLE public.project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2),
  link TEXT,
  notes TEXT,
  purchased BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_materials IS 'Lista materiali di un progetto, in stile foglio di calcolo: quantità, prezzo unitario e stato acquisto.';

CREATE INDEX idx_project_materials_project ON public.project_materials(project_id);

ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project materials"
  ON public.project_materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project materials"
  ON public.project_materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project materials"
  ON public.project_materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project materials"
  ON public.project_materials FOR DELETE
  USING (auth.uid() = user_id);
