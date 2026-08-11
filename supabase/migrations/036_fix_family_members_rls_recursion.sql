-- Le policy introdotte in 034/035 controllano l'appartenenza alla famiglia
-- interrogando direttamente public.family_members da dentro le policy DI
-- family_members stessa: per valutare "sono un membro?" Postgres deve
-- rivalutare la policy SELECT di family_members, che rifà la stessa
-- domanda all'infinito ("infinite recursion detected in policy for
-- relation family_members"). Soluzione standard: due funzioni
-- SECURITY DEFINER che leggono la tabella bypassando la RLS (girano con i
-- privilegi del proprietario, che non e' soggetto alle sue stesse policy),
-- usate al posto della subquery diretta in tutte le policy interessate.

CREATE OR REPLACE FUNCTION public.is_family_member(check_uid UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE user_id = check_uid);
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(check_uid UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE user_id = check_uid AND role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.is_family_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO authenticated;

-- family_members: ricrea le policy usando le funzioni
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete" ON public.family_members;

CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT
  USING (public.is_family_member(auth.uid()));

CREATE POLICY "family_members_insert" ON public.family_members
  FOR INSERT
  WITH CHECK (public.is_family_admin(auth.uid()));

CREATE POLICY "family_members_update" ON public.family_members
  FOR UPDATE
  USING (public.is_family_admin(auth.uid()));

CREATE POLICY "family_members_delete" ON public.family_members
  FOR DELETE
  USING (public.is_family_admin(auth.uid()) AND user_id <> auth.uid());

-- Lista della spesa: stesse policy, stessa correzione (dipendevano dalla
-- stessa subquery ricorsiva)
DROP POLICY IF EXISTS "shopping_products_all" ON public.shopping_products;
DROP POLICY IF EXISTS "shopping_lists_all" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_list_items_all" ON public.shopping_list_items;

CREATE POLICY "shopping_products_all" ON public.shopping_products
  FOR ALL
  USING (public.is_family_member(auth.uid()))
  WITH CHECK (public.is_family_member(auth.uid()));

CREATE POLICY "shopping_lists_all" ON public.shopping_lists
  FOR ALL
  USING (public.is_family_member(auth.uid()))
  WITH CHECK (public.is_family_member(auth.uid()));

CREATE POLICY "shopping_list_items_all" ON public.shopping_list_items
  FOR ALL
  USING (public.is_family_member(auth.uid()))
  WITH CHECK (public.is_family_member(auth.uid()));
