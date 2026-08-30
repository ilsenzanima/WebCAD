-- L'avviso "authenticated puo' eseguire una funzione SECURITY DEFINER" non si
-- puo' togliere restando in public: PostgREST espone via /rest/v1/rpc/...
-- ogni funzione dello schema public eseguibile dal ruolo, e le policy RLS
-- richiedono che authenticated possa comunque eseguirla. La soluzione che
-- Supabase stesso consiglia e' spostare la funzione fuori dallo schema
-- esposto dall'API: le policy continuano a chiamarla normalmente (Postgres
-- non ha limiti a riguardo), ma sparisce l'endpoint pubblico e con lui
-- l'avviso, per entrambi i ruoli.

create schema if not exists private;
grant usage on schema private to authenticated;

drop policy if exists "family_members_select" on public.family_members;
drop policy if exists "family_members_insert" on public.family_members;
drop policy if exists "family_members_update" on public.family_members;
drop policy if exists "family_members_delete" on public.family_members;
drop policy if exists "shopping_products_all" on public.shopping_products;
drop policy if exists "shopping_lists_all" on public.shopping_lists;
drop policy if exists "shopping_list_items_all" on public.shopping_list_items;
drop policy if exists "shopping_product_brands_all" on public.shopping_product_brands;

alter function public.is_family_member() set schema private;
alter function public.is_family_admin() set schema private;

create policy "family_members_select" on public.family_members
  for select
  using (private.is_family_member());

create policy "family_members_insert" on public.family_members
  for insert
  with check (private.is_family_admin());

create policy "family_members_update" on public.family_members
  for update
  using (private.is_family_admin());

create policy "family_members_delete" on public.family_members
  for delete
  using (private.is_family_admin() and user_id <> auth.uid());

create policy "shopping_products_all" on public.shopping_products
  for all
  using (private.is_family_member())
  with check (private.is_family_member());

create policy "shopping_lists_all" on public.shopping_lists
  for all
  using (private.is_family_member())
  with check (private.is_family_member());

create policy "shopping_list_items_all" on public.shopping_list_items
  for all
  using (private.is_family_member())
  with check (private.is_family_member());

create policy "shopping_product_brands_all" on public.shopping_product_brands
  for all
  using (private.is_family_member())
  with check (private.is_family_member());
