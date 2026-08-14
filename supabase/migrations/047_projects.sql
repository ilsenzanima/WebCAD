-- Progetti personali: al posto del Tracker Ragazzi, una vetrina per
-- annotare più progetti separati (nome + descrizione) con una sezione
-- di note libere per ciascuno. Dato personale (come Finanze), non
-- condiviso con la famiglia.

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.projects IS 'Progetti personali dell''utente: nome, descrizione e note collegate.';

CREATE TABLE public.project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_notes IS 'Note libere collegate a un progetto, in ordine cronologico.';

CREATE INDEX idx_project_notes_project ON public.project_notes(project_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own project notes"
  ON public.project_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project notes"
  ON public.project_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project notes"
  ON public.project_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project notes"
  ON public.project_notes FOR DELETE
  USING (auth.uid() = user_id);
