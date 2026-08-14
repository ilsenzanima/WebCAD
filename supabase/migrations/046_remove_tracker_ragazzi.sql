-- Rimuove il Tracker Ragazzi (compiti/ricompense, crescita/salute,
-- attività): l'app resta a uso personale, non serve più questa parte
-- pensata per condividere l'app con i figli.

DROP TABLE IF EXISTS public.reward_redemptions;
DROP TABLE IF EXISTS public.rewards;
DROP TABLE IF EXISTS public.chores;
DROP TABLE IF EXISTS public.growth_entries;
DROP TABLE IF EXISTS public.family_activities;

ALTER TABLE public.family_members DROP COLUMN IF EXISTS avatar_emoji;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS birth_date;
