-- La tab Disegno diventa una vetrina con piu' disegni per progetto,
-- invece di un unico schizzo per progetto. Sostituisce projects.sketch_data
-- con una tabella dedicata (un disegno = una riga), migrando l'eventuale
-- disegno gia' presente prima di rimuovere la vecchia colonna.

CREATE TABLE public.project_sketches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL DEFAULT 'Disegno senza titolo',
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_sketches IS 'Disegni di un progetto (vetrina): ogni riga e'' uno schizzo vettoriale indipendente, apribile a tutta pagina.';

CREATE INDEX idx_project_sketches_project ON public.project_sketches(project_id);

ALTER TABLE public.project_sketches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project sketches"
  ON public.project_sketches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project sketches"
  ON public.project_sketches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project sketches"
  ON public.project_sketches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project sketches"
  ON public.project_sketches FOR DELETE
  USING (auth.uid() = user_id);

-- Migra l'eventuale disegno singolo gia' salvato su projects.sketch_data.
INSERT INTO public.project_sketches (project_id, user_id, name, strokes)
SELECT id, user_id, 'Disegno', sketch_data
FROM public.projects
WHERE sketch_data IS NOT NULL AND jsonb_array_length(sketch_data) > 0;

ALTER TABLE public.projects DROP COLUMN sketch_data;
