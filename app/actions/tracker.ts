"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyRole } from "@/app/actions/family";
import type { Chore, Reward, RewardRedemption, GrowthEntry, FamilyActivity } from "@/lib/types/database";

function revalidateTracker() {
  revalidatePath("/dashboard/tracker-ragazzi", "layout");
}

async function requireAdminOrThrow() {
  const role = await getMyRole();
  if (role !== "admin") throw new Error("Solo un amministratore può farlo");
}

// ============================================
// Compiti/faccende
// ============================================

export async function getChores(): Promise<Chore[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("chores")
      .select("*")
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getChores:", err.message);
    return [];
  }
}

export async function createChore(formData: {
  assigned_to: string;
  title: string;
  notes?: string | null;
  points?: number;
  due_date?: string | null;
  recurrence?: "once" | "daily" | "weekly";
}) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("chores")
      .insert({
        assigned_to: formData.assigned_to,
        title: formData.title.trim(),
        notes: formData.notes || null,
        points: formData.points ?? 1,
        due_date: formData.due_date || null,
        recurrence: formData.recurrence || "once",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteChore(id: string) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("chores").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Il ragazzo segna il compito come fatto: resta da approvare da un admin
// prima che i punti contino nel saldo.
export async function markChoreDone(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: chore } = await supabase.from("chores").select("assigned_to").eq("id", id).maybeSingle();
    const role = await getMyRole();
    if (!chore) throw new Error("Compito non trovato");
    if (chore.assigned_to !== user.id && role !== "admin") {
      throw new Error("Puoi segnare come fatti solo i tuoi compiti");
    }

    const { error } = await supabase.from("chores").update({ status: "done", done_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Un admin conferma il compito fatto (assegna i punti) o lo rimanda indietro.
export async function reviewChore(id: string, approve: boolean) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;

    const { error } = await supabase
      .from("chores")
      .update(approve ? { status: "approved", approved_at: new Date().toISOString() } : { status: "pending", done_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Ricompense
// ============================================

export async function getRewards(): Promise<Reward[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("rewards").select("*").order("cost_points", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getRewards:", err.message);
    return [];
  }
}

export async function createReward(formData: { title: string; cost_points: number }) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("rewards")
      .insert({ title: formData.title.trim(), cost_points: formData.cost_points, created_by: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateReward(id: string, formData: { title?: string; cost_points?: number; is_active?: boolean }) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.title !== undefined) update.title = formData.title.trim();
    if (formData.cost_points !== undefined) update.cost_points = formData.cost_points;
    if (formData.is_active !== undefined) update.is_active = formData.is_active;

    const { error } = await supabase.from("rewards").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteReward(id: string) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("rewards").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRedemptions(): Promise<RewardRedemption[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("*, rewards(*)")
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getRedemptions:", err.message);
    return [];
  }
}

export async function requestRedemption(rewardId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("reward_redemptions")
      .insert({ reward_id: rewardId, requested_by: user.id })
      .select("*, rewards(*)")
      .single();
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolveRedemption(id: string, approve: boolean) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;

    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status: approve ? "approved" : "denied", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Saldo punti per membro: somma punti dei compiti approvati meno il costo
// delle ricompense approvate. Calcolato al volo (come i saldi dei conti),
// cosi' resta sempre coerente senza un contatore da tenere allineato.
export async function getPointsBalances(): Promise<Record<string, number>> {
  try {
    const supabase = (await createClient()) as any;
    const [{ data: chores }, { data: redemptions }] = await Promise.all([
      supabase.from("chores").select("assigned_to, points").eq("status", "approved"),
      supabase.from("reward_redemptions").select("requested_by, rewards(cost_points)").eq("status", "approved"),
    ]);

    const balances: Record<string, number> = {};
    (chores || []).forEach((c: any) => { balances[c.assigned_to] = (balances[c.assigned_to] || 0) + c.points; });
    (redemptions || []).forEach((r: any) => { balances[r.requested_by] = (balances[r.requested_by] || 0) - (r.rewards?.cost_points || 0); });
    return balances;
  } catch (err: any) {
    console.error("Errore getPointsBalances:", err.message);
    return {};
  }
}

// ============================================
// Crescita/salute
// ============================================

export async function getGrowthEntries(): Promise<GrowthEntry[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("growth_entries").select("*").order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getGrowthEntries:", err.message);
    return [];
  }
}

export async function createGrowthEntry(formData: {
  family_member: string;
  date: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  note?: string | null;
}) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("growth_entries")
      .insert({
        family_member: formData.family_member,
        date: formData.date,
        height_cm: formData.height_cm ?? null,
        weight_kg: formData.weight_kg ?? null,
        note: formData.note || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteGrowthEntry(id: string) {
  try {
    await requireAdminOrThrow();
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("growth_entries").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Attività/impegni
// ============================================

export async function getActivities(): Promise<FamilyActivity[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("family_activities").select("*").order("start_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getActivities:", err.message);
    return [];
  }
}

export async function createActivity(formData: {
  family_member: string | null;
  title: string;
  location?: string | null;
  notes?: string | null;
  start_at: string;
  end_at?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("family_activities")
      .insert({
        family_member: formData.family_member || null,
        title: formData.title.trim(),
        location: formData.location || null,
        notes: formData.notes || null,
        start_at: formData.start_at,
        end_at: formData.end_at || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteActivity(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("family_activities").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateTracker();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
