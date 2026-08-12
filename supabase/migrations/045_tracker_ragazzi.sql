-- Tracker Ragazzi: compiti/ricompense, crescita/salute, attività/impegni.
-- Condiviso da tutta la famiglia (stesso criterio di shopping_products:
-- chiunque sia in family_members ha accesso). Le regole piu' fini (solo
-- l'admin puo' approvare un compito, solo l'admin registra la crescita...)
-- si applicano nelle azioni server, non nella RLS, come gia' fatto altrove
-- in questo progetto (es. requireAdmin() in family.ts).

-- Profilo minimo per i membri della famiglia: emoji come avatar rapido e
-- data di nascita opzionale (utile per l'area crescita/salute).
ALTER TABLE public.family_members ADD COLUMN avatar_emoji VARCHAR(8) NOT NULL DEFAULT '🙂';
ALTER TABLE public.family_members ADD COLUMN birth_date DATE;

-- ============================================
-- Compiti/faccende e ricompense
-- ============================================

CREATE TABLE public.chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  notes TEXT,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points >= 0),
  due_date DATE,
  recurrence VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once', 'daily', 'weekly')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'approved')),
  done_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chores IS 'Compiti/faccende assegnati a un membro della famiglia: pending -> done (segnato dal ragazzo) -> approved (confermato da un admin, assegna i punti).';

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  cost_points INTEGER NOT NULL CHECK (cost_points >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rewards IS 'Catalogo ricompense riscattabili con i punti guadagnati facendo i compiti.';

CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'denied')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON TABLE public.reward_redemptions IS 'Richieste di riscatto di una ricompensa: requested (dal ragazzo) -> approved/denied (da un admin).';

-- ============================================
-- Crescita/salute
-- ============================================

CREATE TABLE public.growth_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  height_cm NUMERIC(5, 1),
  weight_kg NUMERIC(5, 1),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.growth_entries IS 'Rilevazioni di crescita (altezza/peso) nel tempo per un membro della famiglia.';

-- ============================================
-- Attività/impegni
-- ============================================

CREATE TABLE public.family_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = riguarda tutta la famiglia
  title VARCHAR(150) NOT NULL,
  location VARCHAR(150),
  notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.family_activities IS 'Attività e impegni (sport, corsi, appuntamenti) di un membro della famiglia o di tutti.';

CREATE INDEX idx_chores_assigned_to ON public.chores(assigned_to);
CREATE INDEX idx_reward_redemptions_reward ON public.reward_redemptions(reward_id);
CREATE INDEX idx_growth_entries_member ON public.growth_entries(family_member);
CREATE INDEX idx_family_activities_member ON public.family_activities(family_member);

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chores_all" ON public.chores
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "rewards_all" ON public.rewards
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "reward_redemptions_all" ON public.reward_redemptions
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "growth_entries_all" ON public.growth_entries
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));

CREATE POLICY "family_activities_all" ON public.family_activities
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.family_members))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.family_members));
