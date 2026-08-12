"use client";

import { useState, useTransition, useMemo } from "react";
import type { FamilyMember, Chore, Reward, RewardRedemption, GrowthEntry, FamilyActivity } from "@/lib/types/database";
import {
  createChore, deleteChore, markChoreDone, reviewChore,
  createReward, updateReward, deleteReward,
  requestRedemption, resolveRedemption,
  createGrowthEntry, deleteGrowthEntry,
  createActivity, deleteActivity,
} from "@/app/actions/tracker";
import { formatDate } from "@/lib/format";
import { DeleteIcon, CheckIcon } from "./icons";

interface TrackerRagazziClientProps {
  members: FamilyMember[];
  myUserId: string;
  isAdmin: boolean;
  initialChores: Chore[];
  initialRewards: Reward[];
  initialRedemptions: RewardRedemption[];
  initialBalances: Record<string, number>;
  initialGrowthEntries: GrowthEntry[];
  initialActivities: FamilyActivity[];
}

const RECURRENCE_LABELS: Record<Chore["recurrence"], string> = { once: "Una tantum", daily: "Ogni giorno", weekly: "Ogni settimana" };

export default function TrackerRagazziClient({
  members, myUserId, isAdmin,
  initialChores, initialRewards, initialRedemptions, initialBalances, initialGrowthEntries, initialActivities,
}: TrackerRagazziClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"chores" | "rewards" | "growth" | "activities">("chores");

  const [chores, setChores] = useState<Chore[]>(initialChores);
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>(initialRedemptions);
  const [balances, setBalances] = useState<Record<string, number>>(initialBalances);
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>(initialGrowthEntries);
  const [activities, setActivities] = useState<FamilyActivity[]>(initialActivities);

  const memberById = useMemo(() => {
    const map: Record<string, FamilyMember> = {};
    members.forEach((m) => { map[m.user_id] = m; });
    return map;
  }, [members]);

  const memberLabel = (userId: string | null) => {
    if (!userId) return "Tutta la famiglia";
    const m = memberById[userId];
    return m ? `${m.avatar_emoji} ${m.display_name}` : "—";
  };

  // ---------------- Compiti ----------------
  const [showChoreModal, setShowChoreModal] = useState(false);
  const [choreAssignedTo, setChoreAssignedTo] = useState("");
  const [choreTitle, setChoreTitle] = useState("");
  const [chorePoints, setChorePoints] = useState("1");
  const [choreDueDate, setChoreDueDate] = useState("");
  const [choreRecurrence, setChoreRecurrence] = useState<Chore["recurrence"]>("once");

  const resetChoreForm = () => {
    setChoreAssignedTo(""); setChoreTitle(""); setChorePoints("1"); setChoreDueDate(""); setChoreRecurrence("once");
    setShowChoreModal(false);
  };

  const handleCreateChore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!choreAssignedTo || !choreTitle.trim()) { alert("Scegli il ragazzo e il titolo del compito"); return; }
    startTransition(async () => {
      const res = await createChore({
        assigned_to: choreAssignedTo,
        title: choreTitle.trim(),
        points: Number(chorePoints) || 1,
        due_date: choreDueDate || null,
        recurrence: choreRecurrence,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      setChores((prev) => [...prev, res.data as Chore]);
      resetChoreForm();
    });
  };

  const handleMarkDone = (id: string) => {
    setChores((prev) => prev.map((c) => (c.id === id ? { ...c, status: "done" } : c)));
    startTransition(async () => {
      const res = await markChoreDone(id);
      if (!res.success) alert(res.error);
    });
  };

  const handleReviewChore = (chore: Chore, approve: boolean) => {
    setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, status: approve ? "approved" : "pending" } : c)));
    if (approve) setBalances((prev) => ({ ...prev, [chore.assigned_to]: (prev[chore.assigned_to] || 0) + chore.points }));
    startTransition(async () => {
      const res = await reviewChore(chore.id, approve);
      if (!res.success) alert(res.error);
    });
  };

  const handleDeleteChore = (id: string) => {
    if (!confirm("Eliminare questo compito?")) return;
    setChores((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      const res = await deleteChore(id);
      if (!res.success) alert(res.error);
    });
  };

  const STATUS_ORDER: Chore["status"][] = ["pending", "done", "approved"];
  const STATUS_LABELS: Record<Chore["status"], string> = { pending: "Da fare", done: "Da approvare", approved: "Completati" };

  // ---------------- Ricompense ----------------
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardCost, setRewardCost] = useState("10");

  const handleCreateReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim()) { alert("Inserisci il nome della ricompensa"); return; }
    startTransition(async () => {
      const res = await createReward({ title: rewardTitle.trim(), cost_points: Number(rewardCost) || 0 });
      if (!res.success || !res.data) { alert(res.error); return; }
      setRewards((prev) => [...prev, res.data as Reward]);
      setRewardTitle(""); setRewardCost("10"); setShowRewardModal(false);
    });
  };

  const handleDeleteReward = (id: string) => {
    if (!confirm("Eliminare questa ricompensa?")) return;
    setRewards((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      const res = await deleteReward(id);
      if (!res.success) alert(res.error);
    });
  };

  const handleRequestRedemption = (reward: Reward) => {
    startTransition(async () => {
      const res = await requestRedemption(reward.id);
      if (!res.success || !res.data) { alert(res.error); return; }
      setRedemptions((prev) => [res.data as RewardRedemption, ...prev]);
    });
  };

  const handleResolveRedemption = (redemption: RewardRedemption, approve: boolean) => {
    setRedemptions((prev) => prev.map((r) => (r.id === redemption.id ? { ...r, status: approve ? "approved" : "denied" } : r)));
    if (approve && redemption.rewards) {
      setBalances((prev) => ({ ...prev, [redemption.requested_by]: (prev[redemption.requested_by] || 0) - redemption.rewards!.cost_points }));
    }
    startTransition(async () => {
      const res = await resolveRedemption(redemption.id, approve);
      if (!res.success) alert(res.error);
    });
  };

  // ---------------- Crescita/salute ----------------
  const [growthMemberFilter, setGrowthMemberFilter] = useState<string>(isAdmin ? members[0]?.user_id || "" : myUserId);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [growthDate, setGrowthDate] = useState("");
  const [growthHeight, setGrowthHeight] = useState("");
  const [growthWeight, setGrowthWeight] = useState("");
  const [growthNote, setGrowthNote] = useState("");

  const handleCreateGrowthEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!growthMemberFilter || !growthDate) { alert("Scegli il membro e la data"); return; }
    startTransition(async () => {
      const res = await createGrowthEntry({
        family_member: growthMemberFilter,
        date: growthDate,
        height_cm: growthHeight ? Number(growthHeight) : null,
        weight_kg: growthWeight ? Number(growthWeight) : null,
        note: growthNote.trim() || null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      setGrowthEntries((prev) => [...prev, res.data as GrowthEntry].sort((a, b) => a.date.localeCompare(b.date)));
      setGrowthDate(""); setGrowthHeight(""); setGrowthWeight(""); setGrowthNote(""); setShowGrowthModal(false);
    });
  };

  const handleDeleteGrowthEntry = (id: string) => {
    if (!confirm("Eliminare questa rilevazione?")) return;
    setGrowthEntries((prev) => prev.filter((g) => g.id !== id));
    startTransition(async () => {
      const res = await deleteGrowthEntry(id);
      if (!res.success) alert(res.error);
    });
  };

  const growthForMember = growthEntries.filter((g) => g.family_member === growthMemberFilter);

  // ---------------- Attività/impegni ----------------
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityMember, setActivityMember] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityLocation, setActivityLocation] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim() || !activityStart) { alert("Inserisci titolo e data/ora"); return; }
    startTransition(async () => {
      const res = await createActivity({
        family_member: activityMember || null,
        title: activityTitle.trim(),
        location: activityLocation.trim() || null,
        start_at: new Date(activityStart).toISOString(),
        end_at: activityEnd ? new Date(activityEnd).toISOString() : null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      setActivities((prev) => [...prev, res.data as FamilyActivity].sort((a, b) => a.start_at.localeCompare(b.start_at)));
      setActivityMember(""); setActivityTitle(""); setActivityLocation(""); setActivityStart(""); setActivityEnd("");
      setShowActivityModal(false);
    });
  };

  const handleDeleteActivity = (id: string) => {
    if (!confirm("Eliminare questa attività?")) return;
    setActivities((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      const res = await deleteActivity(id);
      if (!res.success) alert(res.error);
    });
  };

  const now = new Date();
  const upcomingActivities = activities.filter((a) => new Date(a.start_at) >= now);
  const pastActivities = activities.filter((a) => new Date(a.start_at) < now);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            🧒 Tracker Ragazzi
          </h1>
          <p className="text-sm text-slate-400 mt-1">Compiti e ricompense, crescita/salute, attività e impegni della famiglia.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-zinc-950/80 border border-white/10 rounded-2xl w-fit flex-wrap">
          {([
            ["chores", "✅ Compiti"],
            ["rewards", "🎁 Ricompense"],
            ["growth", "📈 Crescita"],
            ["activities", "🗓️ Attività"],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === key ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Saldo punti per membro (un ragazzo vede solo il proprio) */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-fade-in">
          {(isAdmin ? members : members.filter((m) => m.user_id === myUserId)).map((m) => (
            <span key={m.user_id} className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-zinc-900 border border-zinc-800 text-white">
              {m.avatar_emoji} {m.display_name}: <span className="text-amber-300">{balances[m.user_id] || 0} pt</span>
            </span>
          ))}
        </div>
      )}

      {/* -------- Tab Compiti -------- */}
      {activeTab === "chores" && (
        <div className="space-y-5 animate-fade-in">
          {isAdmin && (
            <button type="button" onClick={() => setShowChoreModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}>
              <span>＋</span> Nuovo compito
            </button>
          )}

          {STATUS_ORDER.map((status) => {
            const items = chores.filter((c) => c.status === status);
            if (items.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{STATUS_LABELS[status]}</h3>
                <div className="space-y-2">
                  {items.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-white flex-1 min-w-[140px]">
                        {c.title}
                        <span className="text-zinc-500 font-normal"> · {memberLabel(c.assigned_to)}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">{c.points} pt</span>
                      {c.due_date && <span className="text-[10px] text-zinc-500">entro {formatDate(c.due_date)}</span>}
                      {c.recurrence !== "once" && <span className="text-[10px] text-zinc-500">🔁 {RECURRENCE_LABELS[c.recurrence]}</span>}

                      {status === "pending" && (isAdmin || c.assigned_to === myUserId) && (
                        <button onClick={() => handleMarkDone(c.id)} disabled={isPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                          Segna come fatto
                        </button>
                      )}
                      {status === "done" && isAdmin && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleReviewChore(c, true)} disabled={isPending}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                            ✓ Approva
                          </button>
                          <button onClick={() => handleReviewChore(c, false)} disabled={isPending}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-all">
                            ↩ Rimanda
                          </button>
                        </div>
                      )}
                      {status === "approved" && <CheckIcon size={14} className="text-emerald-400" />}
                      {isAdmin && (
                        <button onClick={() => handleDeleteChore(c.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all">
                          <DeleteIcon size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {chores.length === 0 && <p className="text-[11px] text-zinc-500">Nessun compito ancora assegnato.</p>}
        </div>
      )}

      {/* -------- Tab Ricompense -------- */}
      {activeTab === "rewards" && (
        <div className="space-y-5 animate-fade-in">
          {isAdmin && (
            <button type="button" onClick={() => setShowRewardModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}>
              <span>＋</span> Nuova ricompensa
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rewards.filter((r) => r.is_active).map((r) => {
              const myBalance = balances[myUserId] || 0;
              const canAfford = myBalance >= r.cost_points;
              return (
                <div key={r.id} className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white">{r.title}</span>
                    {isAdmin && (
                      <button onClick={() => handleDeleteReward(r.id)} className="text-slate-500 hover:text-rose-400 transition-all flex-shrink-0">
                        <DeleteIcon size={12} />
                      </button>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-block">{r.cost_points} pt</span>
                  <button onClick={() => handleRequestRedemption(r)} disabled={isPending || !canAfford}
                    className="w-full py-2 rounded-lg text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-30">
                    {canAfford ? "Riscatta" : "Punti insufficienti"}
                  </button>
                </div>
              );
            })}
            {rewards.length === 0 && <p className="text-[11px] text-zinc-500">Nessuna ricompensa ancora nel catalogo.</p>}
          </div>

          {redemptions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Richieste di riscatto</h3>
              <div className="space-y-2">
                {redemptions.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-white flex-1 min-w-[140px]">
                      {r.rewards?.title} <span className="text-zinc-500 font-normal">· {memberLabel(r.requested_by)}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      r.status === "approved" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : r.status === "denied" ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {r.status === "approved" ? "Approvata" : r.status === "denied" ? "Rifiutata" : "In attesa"}
                    </span>
                    {isAdmin && r.status === "requested" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleResolveRedemption(r, true)} disabled={isPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                          ✓ Approva
                        </button>
                        <button onClick={() => handleResolveRedemption(r, false)} disabled={isPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all">
                          ✕ Rifiuta
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------- Tab Crescita -------- */}
      {activeTab === "growth" && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isAdmin && (
              <div className="flex gap-1.5 flex-wrap">
                {members.map((m) => (
                  <button key={m.user_id} type="button" onClick={() => setGrowthMemberFilter(m.user_id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                      growthMemberFilter === m.user_id ? "bg-white/10 text-white border-white/20" : "text-zinc-400 border-zinc-800 hover:text-white"
                    }`}>
                    {m.avatar_emoji} {m.display_name}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && (
              <button type="button" onClick={() => { setGrowthDate(""); setShowGrowthModal(true); }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}>
                <span>＋</span> Nuova rilevazione
              </button>
            )}
          </div>

          <div className="space-y-2">
            {[...growthForMember].reverse().map((g) => (
              <div key={g.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-400 w-24">{formatDate(g.date)}</span>
                {g.height_cm != null && <span className="text-xs font-bold text-white">{g.height_cm} cm</span>}
                {g.weight_kg != null && <span className="text-xs font-bold text-white">{g.weight_kg} kg</span>}
                {g.note && <span className="text-[11px] text-zinc-500 flex-1">{g.note}</span>}
                {isAdmin && (
                  <button onClick={() => handleDeleteGrowthEntry(g.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all ml-auto">
                    <DeleteIcon size={13} />
                  </button>
                )}
              </div>
            ))}
            {growthForMember.length === 0 && <p className="text-[11px] text-zinc-500">Nessuna rilevazione ancora per questo membro.</p>}
          </div>
        </div>
      )}

      {/* -------- Tab Attività -------- */}
      {activeTab === "activities" && (
        <div className="space-y-5 animate-fade-in">
          <button type="button" onClick={() => setShowActivityModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}>
            <span>＋</span> Nuova attività
          </button>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">In arrivo</h3>
            <div className="space-y-2">
              {upcomingActivities.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-white flex-1 min-w-[140px]">
                    {a.title} <span className="text-zinc-500 font-normal">· {memberLabel(a.family_member)}</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">{formatDate(a.start_at)} {new Date(a.start_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                  {a.location && <span className="text-[10px] text-zinc-500">📍 {a.location}</span>}
                  <button onClick={() => handleDeleteActivity(a.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all">
                    <DeleteIcon size={13} />
                  </button>
                </div>
              ))}
              {upcomingActivities.length === 0 && <p className="text-[11px] text-zinc-500">Nessuna attività in programma.</p>}
            </div>
          </div>

          {pastActivities.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Passate</h3>
              <div className="space-y-2 opacity-60">
                {[...pastActivities].reverse().map((a) => (
                  <div key={a.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-white flex-1 min-w-[140px]">
                      {a.title} <span className="text-zinc-500 font-normal">· {memberLabel(a.family_member)}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">{formatDate(a.start_at)}</span>
                    <button onClick={() => handleDeleteActivity(a.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all">
                      <DeleteIcon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modale Nuovo Compito */}
      {showChoreModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto" onClick={resetChoreForm}>
          <div className="relative w-full max-w-md my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={resetChoreForm} className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">✕</button>
            <h2 className="text-base font-extrabold text-white mb-4">Nuovo compito</h2>
            <form onSubmit={handleCreateChore} className="space-y-3">
              <select value={choreAssignedTo} onChange={(e) => setChoreAssignedTo(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Assegna a...</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.avatar_emoji} {m.display_name}</option>)}
              </select>
              <input value={choreTitle} onChange={(e) => setChoreTitle(e.target.value)} placeholder="Titolo (es. Rifare il letto)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input type="number" min={0} value={chorePoints} onChange={(e) => setChorePoints(e.target.value)} placeholder="Punti"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input type="date" value={choreDueDate} onChange={(e) => setChoreDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={choreRecurrence} onChange={(e) => setChoreRecurrence(e.target.value as Chore["recurrence"])}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea compito
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuova Ricompensa */}
      {showRewardModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto" onClick={() => setShowRewardModal(false)}>
          <div className="relative w-full max-w-md my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowRewardModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">✕</button>
            <h2 className="text-base font-extrabold text-white mb-4">Nuova ricompensa</h2>
            <form onSubmit={handleCreateReward} className="space-y-3">
              <input value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="Titolo (es. Un'ora di videogiochi)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input type="number" min={0} value={rewardCost} onChange={(e) => setRewardCost(e.target.value)} placeholder="Costo in punti"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea ricompensa
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuova Rilevazione Crescita */}
      {showGrowthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto" onClick={() => setShowGrowthModal(false)}>
          <div className="relative w-full max-w-md my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowGrowthModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">✕</button>
            <h2 className="text-base font-extrabold text-white mb-1">Nuova rilevazione</h2>
            <p className="text-[10px] text-zinc-500 mb-4">{memberLabel(growthMemberFilter)}</p>
            <form onSubmit={handleCreateGrowthEntry} className="space-y-3">
              <input type="date" value={growthDate} onChange={(e) => setGrowthDate(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input type="number" step="0.1" value={growthHeight} onChange={(e) => setGrowthHeight(e.target.value)} placeholder="Altezza (cm)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input type="number" step="0.1" value={growthWeight} onChange={(e) => setGrowthWeight(e.target.value)} placeholder="Peso (kg)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input value={growthNote} onChange={(e) => setGrowthNote(e.target.value)} placeholder="Nota (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Salva rilevazione
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuova Attività */}
      {showActivityModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto" onClick={() => setShowActivityModal(false)}>
          <div className="relative w-full max-w-md my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowActivityModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">✕</button>
            <h2 className="text-base font-extrabold text-white mb-4">Nuova attività</h2>
            <form onSubmit={handleCreateActivity} className="space-y-3">
              <select value={activityMember} onChange={(e) => setActivityMember(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Tutta la famiglia</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.avatar_emoji} {m.display_name}</option>)}
              </select>
              <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Titolo (es. Allenamento calcio)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input value={activityLocation} onChange={(e) => setActivityLocation(e.target.value)} placeholder="Luogo (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inizio</label>
                <input type="datetime-local" value={activityStart} onChange={(e) => setActivityStart(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fine (opzionale)</label>
                <input type="datetime-local" value={activityEnd} onChange={(e) => setActivityEnd(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              </div>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea attività
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
