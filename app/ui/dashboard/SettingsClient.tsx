"use client";

import { useState, useTransition } from "react";
import { changePassword, logout } from "@/app/actions/auth";
import { createCategory, deleteCategory } from "@/app/actions/categories";
import { createSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { UserIcon, LockIcon, TagIcon, SupplierIcon, DeleteIcon } from "./icons";

interface Props {
  user: {
    id: string;
    email?: string;
    fullName: string;
  };
  initialCategories: ExpenseCategory[];
  initialSuppliers: Supplier[];
}

const PRESET_COLORS = [
  { name: "Indigo", value: "indigo", bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  { name: "Rose", value: "rose", bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  { name: "Emerald", value: "emerald", bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  { name: "Amber", value: "amber", bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  { name: "Sky", value: "sky", bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  { name: "Pink", value: "pink", bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  { name: "Purple", value: "purple", bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  { name: "Slate", value: "slate", bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
];

export default function SettingsClient({ user, initialCategories, initialSuppliers }: Props) {
  const [activeTab, setActiveTab] = useState<"security" | "categories" | "suppliers">("security");
  const [isPending, startTransition] = useTransition();

  // Liste locali gestite reattivamente
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  // Stato form cambio password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Stato form Categoria
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PRESET_COLORS[0].value);

  // Stato form Fornitore
  const [supName, setSupName] = useState("");
  const [supDesc, setSupDesc] = useState("");

  // 🔐 Gestore cambio password
  function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    const pwd = newPassword.trim();
    const conf = confirmPassword.trim();

    if (pwd.length < 6) {
      setPwdError("La password deve contenere almeno 6 caratteri.");
      return;
    }
    if (pwd !== conf) {
      setPwdError("Le password non coincidono.");
      return;
    }

    startTransition(async () => {
      const res = await changePassword(pwd);
      if (res.success) {
        setPwdSuccess("Password aggiornata con successo!");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdError(res.error ?? "Errore durante l'aggiornamento della password.");
      }
    });
  }

  // 🏷️ Gestore Categoria (Aggiunta)
  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;

    startTransition(async () => {
      try {
        await createCategory({ name: catName, color: catColor });
        const tempId = Math.random().toString();
        const newCat: ExpenseCategory = {
          id: tempId,
          user_id: user.id,
          name: catName.trim(),
          color: catColor,
          created_at: new Date().toISOString(),
        };
        setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
        setCatName("");
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio.");
      }
    });
  }

  // 🏷️ Gestore Categoria (Eliminazione)
  function handleDeleteCategory(id: string) {
    if (!confirm("Sei sicuro? Le spese collegate a questa categoria non verranno eliminate, ma la categoria verrà impostata a 'Nessuna'.")) return;

    startTransition(async () => {
      try {
        await deleteCategory(id);
        setCategories(prev => prev.filter(c => c.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione.");
      }
    });
  }

  // 🏢 Gestore Fornitore (Aggiunta)
  function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supName.trim()) return;

    startTransition(async () => {
      try {
        await createSupplier({ name: supName, description: supDesc });
        const tempId = Math.random().toString();
        const newSup: Supplier = {
          id: tempId,
          user_id: user.id,
          name: supName.trim(),
          description: supDesc.trim() || null,
          created_at: new Date().toISOString(),
        };
        setSuppliers(prev => [...prev, newSup].sort((a, b) => a.name.localeCompare(b.name)));
        setSupName("");
        setSupDesc("");
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio.");
      }
    });
  }

  // 🏢 Gestore Fornitore (Eliminazione)
  function handleDeleteSupplier(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo fornitore?")) return;

    startTransition(async () => {
      try {
        await deleteSupplier(id);
        setSuppliers(prev => prev.filter(s => s.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione.");
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in px-4 py-8">
      {/* Intestazione */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">⚙️ Impostazioni</h1>
        <p className="text-sm text-slate-400">Personalizza il tuo gestionale spese configurando categorie, fornitori e sicurezza.</p>
      </div>

      {/* Tabs di Navigazione */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("security")}
          className="pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all"
          style={{
            borderColor: activeTab === "security" ? "hsl(220 90% 56%)" : "transparent",
            color: activeTab === "security" ? "white" : "hsl(215 20% 55%)",
          }}
        >
          <LockIcon size={14} /> Sicurezza
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className="pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all"
          style={{
            borderColor: activeTab === "categories" ? "hsl(220 90% 56%)" : "transparent",
            color: activeTab === "categories" ? "white" : "hsl(215 20% 55%)",
          }}
        >
          <TagIcon size={14} /> Categorie
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className="pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all"
          style={{
            borderColor: activeTab === "suppliers" ? "hsl(220 90% 56%)" : "transparent",
            color: activeTab === "suppliers" ? "white" : "hsl(215 20% 55%)",
          }}
        >
          <SupplierIcon size={14} /> Fornitori
        </button>
      </div>

      {/* ─── TAB 1: SICUREZZA ────────────────── */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Card Dati Utente */}
          <div
            className="md:col-span-1 p-6 rounded-2xl border space-y-4 shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white select-none"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{user.fullName}</h3>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => startTransition(() => logout())}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-800/50 transition-all text-center flex items-center justify-center gap-2 border border-zinc-800 text-slate-300"
              >
                <span>↩</span>
                <span>{isPending ? "Uscita..." : "Esci dall'Account"}</span>
              </button>
            </div>
          </div>

          {/* Form Cambio Password */}
          <div
            className="md:col-span-2 p-6 rounded-2xl border space-y-4 shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LockIcon size={14} /> Password & Accesso
            </h3>
            <p className="text-xs text-slate-400">Aggiorna la tua password per proteggere il tuo account.</p>

            {pwdError && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(220,38,38,0.12)", color: "hsl(0 80% 70%)" }}>
                ⚠️ {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(16,185,129,0.12)", color: "hsl(142 60% 75%)" }}>
                ✓ {pwdSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nuova password..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none text-white border focus:border-indigo-500 transition-all"
                  style={{ background: "hsl(240 10% 4%)", borderColor: "hsl(240 5% 18%)" }}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Conferma Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none text-white border focus:border-indigo-500 transition-all"
                  style={{ background: "hsl(240 10% 4%)", borderColor: "hsl(240 5% 18%)" }}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !newPassword || !confirmPassword}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {isPending ? "Salvataggio..." : "Aggiorna Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB 2: GESTIONE CATEGORIE ───────────── */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
          {/* Form Inserimento Categoria */}
          <div
            className="md:col-span-1 p-6 rounded-2xl border h-fit shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <h3 className="text-sm font-bold text-white mb-4">🏷️ Aggiungi Categoria</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nome Categoria</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="es. 🍿 Cinema & Streaming"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-xs text-white outline-none border focus:border-indigo-500 transition-all"
                  style={{ background: "hsl(240 10% 4%)", borderColor: "hsl(240 5% 18%)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Colore Badge</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setCatColor(color.value)}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-center"
                      style={{
                        backgroundColor: color.bg,
                        color: color.text,
                        borderColor: catColor === color.value ? "white" : color.border,
                        boxShadow: catColor === color.value ? "0 0 10px rgba(255,255,255,0.1)" : "none",
                      }}
                    >
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {isPending ? "Salvataggio..." : "Salva Categoria"}
              </button>
            </form>
          </div>

          {/* Elenco Categorie */}
          <div
            className="md:col-span-2 p-6 rounded-2xl border flex flex-col space-y-4 shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <h3 className="text-sm font-bold text-white">Le tue Categorie</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {categories.map(cat => {
                const badge = PRESET_COLORS.find(c => c.value === cat.color) || PRESET_COLORS[0];
                return (
                  <div
                    key={cat.id}
                    className="flex justify-between items-center p-3 rounded-xl border"
                    style={{
                      background: "hsl(240 10% 6% / 0.4)",
                      borderColor: "hsl(240 5% 15%)",
                    }}
                  >
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-bold border"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.text,
                        borderColor: badge.border,
                      }}
                    >
                      {cat.name}
                    </span>
                    
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Elimina"
                    >
                      <DeleteIcon size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: GESTIONE FORNITORI ───────────── */}
      {activeTab === "suppliers" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
          {/* Form Inserimento Fornitore */}
          <div
            className="md:col-span-1 p-6 rounded-2xl border h-fit shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <h3 className="text-sm font-bold text-white mb-4">🏢 Aggiungi Fornitore</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nome Fornitore / Servizio</label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="es. Amazon, Esselunga, Enel..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-xs text-white outline-none border focus:border-indigo-500 transition-all"
                  style={{ background: "hsl(240 10% 4%)", borderColor: "hsl(240 5% 18%)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nota / Descrizione (Opzionale)</label>
                <textarea
                  value={supDesc}
                  onChange={(e) => setSupDesc(e.target.value)}
                  placeholder="es. Spesa alimentari, utenze luce..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs text-white outline-none border focus:border-indigo-500 transition-all h-20 resize-none"
                  style={{ background: "hsl(240 10% 4%)", borderColor: "hsl(240 5% 18%)" }}
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {isPending ? "Salvataggio..." : "Salva Fornitore"}
              </button>
            </form>
          </div>

          {/* Elenco Fornitori */}
          <div
            className="md:col-span-2 p-6 rounded-2xl border flex flex-col space-y-4 shadow-md"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            <h3 className="text-sm font-bold text-white">I tuoi Fornitori</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {suppliers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center sm:col-span-2">Nessun fornitore salvato.</p>
              ) : (
                suppliers.map(sup => (
                  <div
                    key={sup.id}
                    className="flex justify-between items-start p-3.5 rounded-xl border"
                    style={{
                      background: "hsl(240 10% 6% / 0.4)",
                      borderColor: "hsl(240 5% 15%)",
                    }}
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{sup.name}</h4>
                      {sup.description && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{sup.description}</p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleDeleteSupplier(sup.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Elimina"
                    >
                      <DeleteIcon size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
