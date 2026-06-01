-- Abilita la pubblicazione PostgreSQL Realtime per le tabelle del cantiere in modo sicuro

do $$
begin
  -- Crea la pubblicazione se non esiste
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Aggiunge le tabelle alla pubblicazione individualmente solo se non sono già presenti
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table projects;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'levels'
  ) then
    alter publication supabase_realtime add table levels;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_notes'
  ) then
    alter publication supabase_realtime add table field_notes;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'field_note_items'
  ) then
    alter publication supabase_realtime add table field_note_items;
  end if;
end $$;
