import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFamilyMembers, getMyRole } from "@/app/actions/family";
import { getChores, getRewards, getRedemptions, getPointsBalances, getGrowthEntries, getActivities } from "@/app/actions/tracker";
import TrackerRagazziClient from "@/app/ui/dashboard/TrackerRagazziClient";

export const metadata = {
  title: "Tracker Ragazzi - Finanza Privata",
  description: "Compiti e ricompense, crescita/salute, attività e impegni della famiglia",
};

export default async function TrackerRagazziPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [members, role, chores, rewards, redemptions, balances, growthEntries, activities] = await Promise.all([
    getFamilyMembers(),
    getMyRole(),
    getChores(),
    getRewards(),
    getRedemptions(),
    getPointsBalances(),
    getGrowthEntries(),
    getActivities(),
  ]);

  return (
    <TrackerRagazziClient
      members={members}
      myUserId={user.id}
      isAdmin={role === "admin"}
      initialChores={chores}
      initialRewards={rewards}
      initialRedemptions={redemptions}
      initialBalances={balances}
      initialGrowthEntries={growthEntries}
      initialActivities={activities}
    />
  );
}
