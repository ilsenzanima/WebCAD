-- Scheda progetto: tab "Disegno" per fare uno schizzo del progetto.
-- Salvato come dati vettoriali (elenco di tratti con punti e pressione),
-- non come immagine, cosi' resta modificabile e nitido a qualsiasi
-- risoluzione.

ALTER TABLE public.projects ADD COLUMN sketch_data JSONB;
