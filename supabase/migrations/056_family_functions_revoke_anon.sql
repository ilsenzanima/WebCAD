-- 055 revocava l'esecuzione solo da PUBLIC, ma Supabase concede di default a
-- ogni nuova funzione nello schema public un privilegio EXECUTE esplicito per
-- il ruolo anon (privilegio di default a livello di schema, indipendente da
-- PUBLIC): la revoca su PUBLIC non lo rimuove, va tolto esplicitamente.

revoke execute on function public.is_family_member() from anon;
revoke execute on function public.is_family_admin() from anon;
