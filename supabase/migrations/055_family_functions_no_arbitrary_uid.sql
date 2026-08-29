-- Le funzioni is_family_member/is_family_admin (introdotte in 036) accettavano
-- uno uuid arbitrario invece di usare sempre auth.uid(): chiunque, anche senza
-- essere autenticato, poteva chiamarle via /rest/v1/rpc/is_family_admin
-- passando lo uuid di un altro utente e scoprire se e' membro/admin della
-- famiglia (segnalato dal linter di sicurezza di Supabase). In pratica
-- venivano sempre e solo usate con auth.uid(), mai per controllare un altro
-- utente: si toglie quindi il parametro (un utente autenticato puo' cosi'
-- interrogarle solo su se stesso) e si revoca l'esecuzione pubblica/anonima,
-- lasciandola solo a chi e' autenticato (necessario perche' le policy sotto
-- la richiamano durante la valutazione della RLS).

drop policy if exists "family_members_select" on public.family_members;
drop policy if exists "family_members_insert" on public.family_members;
drop policy if exists "family_members_update" on public.family_members;
drop policy if exists "family_members_delete" on public.family_members;
drop policy if exists "shopping_products_all" on public.shopping_products;
drop policy if exists "shopping_lists_all" on public.shopping_lists;
drop policy if exists "shopping_list_items_all" on public.shopping_list_items;
drop policy if exists "shopping_product_brands_all" on public.shopping_product_brands;

drop function if exists public.is_family_member(uuid);
drop function if exists public.is_family_admin(uuid);

create function public.is_family_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.family_members where user_id = auth.uid());
$$;

create function public.is_family_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.family_members where user_id = auth.uid() and role = 'admin');
$$;

revoke execute on function public.is_family_member() from public;
revoke execute on function public.is_family_admin() from public;
grant execute on function public.is_family_member() to authenticated;
grant execute on function public.is_family_admin() to authenticated;

create policy "family_members_select" on public.family_members
  for select
  using (public.is_family_member());

create policy "family_members_insert" on public.family_members
  for insert
  with check (public.is_family_admin());

create policy "family_members_update" on public.family_members
  for update
  using (public.is_family_admin());

create policy "family_members_delete" on public.family_members
  for delete
  using (public.is_family_admin() and user_id <> auth.uid());

create policy "shopping_products_all" on public.shopping_products
  for all
  using (public.is_family_member())
  with check (public.is_family_member());

create policy "shopping_lists_all" on public.shopping_lists
  for all
  using (public.is_family_member())
  with check (public.is_family_member());

create policy "shopping_list_items_all" on public.shopping_list_items
  for all
  using (public.is_family_member())
  with check (public.is_family_member());

create policy "shopping_product_brands_all" on public.shopping_product_brands
  for all
  using (public.is_family_member())
  with check (public.is_family_member());
