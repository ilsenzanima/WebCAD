-- Prodotti "fuori lista": articoli che si prendono spesso in più durante
-- una spesa normale, non legati a una lista specifica. Mostrati come
-- scorciatoie ad aggiunta rapida nel modale di aggiunta articoli.
ALTER TABLE public.shopping_products ADD COLUMN is_off_list BOOLEAN NOT NULL DEFAULT FALSE;
