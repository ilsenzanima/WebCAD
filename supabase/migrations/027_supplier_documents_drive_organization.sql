-- Organizzazione archivio Google Drive per fornitore/anno: memorizza l'id del
-- file su Drive (necessario per spostarlo tra cartelle) e l'anno scelto per il
-- documento, usato per smistare i file scansionati nella cartella corretta
-- Fornitore/Anno invece che alla rinfusa.

alter table public.supplier_documents
  add column if not exists gdrive_file_id text,
  add column if not exists document_year int;

create index if not exists idx_supplier_docs_year on public.supplier_documents(document_year);
