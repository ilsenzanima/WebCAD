-- Modelli CAD 3D di un progetto (motore cascade-core/OpenCascade, solo da
-- PC): il codice CAD e' la fonte di verita' (rieseguito nell'editor per
-- ricostruire la mesh), l'anteprima e' un PNG catturato dopo l'esecuzione,
-- cosi' la vetrina non deve mai caricare il motore WASM pesante.

CREATE TABLE public.project_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL DEFAULT 'Modello senza titolo',
  code TEXT NOT NULL DEFAULT '',
  thumbnail TEXT,
  drive_file_id TEXT,
  drive_link TEXT,
  drive_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_models IS 'Modelli CAD 3D (cascade-core/OpenCascade) di un progetto: codice CAD, anteprima PNG, editor solo da PC.';

CREATE INDEX idx_project_models_project ON public.project_models(project_id);

ALTER TABLE public.project_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project models"
  ON public.project_models FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project models"
  ON public.project_models FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project models"
  ON public.project_models FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project models"
  ON public.project_models FOR DELETE
  USING (auth.uid() = user_id);
