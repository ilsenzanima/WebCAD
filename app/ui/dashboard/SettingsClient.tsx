"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ExpenseCategory } from "@/lib/types/database";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";
import { changePassword } from "@/app/actions/auth";
import { disconnectGoogleDrive } from "@/app/actions/google";
import { EditIcon, DeleteIcon } from "./icons";

interface SettingsClientProps {
  categories: ExpenseCategory[];
  googleConnected: boolean;
}

const COLOR_OPTIONS = [
  { value: "indigo", label: "Indaco", bg: "rgba(99,102,241,0.2)", text: "hsl(245 85% 75%)" },
  { value: "rose", label: "Rosa", bg: "rgba(239,68,68,0.2)", text: "hsl(0 80% 75%)" },
  { value: "emerald", label: "Smeraldo", bg: "rgba(16,185,129,0.2)", text: "hsl(150 70% 70%)" },
  { value: "amber", label: "Ambra", bg: "rgba(245,158,11,0.2)", text: "hsl(38 90% 70%)" },
  { value: "sky", label: "Cielo", bg: "rgba(14,165,233,0.2)", text: "hsl(200 85% 70%)" },
  { value: "pink", label: "Fucsia", bg: "rgba(236,72,153,0.2)", text: "hsl(330 80% 75%)" },
  { value: "purple", label: "Viola", bg: "rgba(168,85,247,0.2)", text: "hsl(270 80% 75%)" },
  { value: "slate", label: "Grigio", bg: "rgba(107,114,128,0.2)", text: "hsl(215 15% 75%)" },
];

export default function SettingsClient({ categories: initialCategories, googleConnected: initialGoogleConnected }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"security" | "categories" | "connections">("categories");
  const [isPending, startTransition] = useTransition();
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) {
      alert(`Errore durante il collegamento a Google: ${googleError}`);
      setActiveTab("connections");
      router.replace("/dashboard/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDisconnectGoogle = () => {
    if (!confirm("Scollegare l'account Google? Non potrai più caricare allegati su Drive né sincronizzare il Calendario finché non lo ricolleghi.")) return;

    startTransition(async () => {
      try {
        const res = await disconnectGoogleDrive();
        if (!res.success) {
          alert(res.error || "Errore durante lo scollegamento");
          return;
        }
        setGoogleConnected(false);
      } catch (err: any) {
        alert(err.message || "Errore durante lo scollegamento");
      }
    });
  };

  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Categories state
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("indigo");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const resetCatForm = () => {
    setCatName("");
    setCatColor("indigo");
    setEditingCatId(null);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("La password deve contenere almeno 6 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Le password non coincidono.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await changePassword(password);
        if (!res.success) {
          alert(res.error || "Errore nell'aggiornamento della password");
          return;
        }
        alert("Password aggiornata con successo!");
        setPassword("");
        setConfirmPassword("");
      } catch (err: any) {
        alert(err.message || "Errore sconosciuto.");
      }
    });
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert("Inserisci un nome per la categoria");
      return;
    }

    startTransition(async () => {
      try {
        if (editingCatId) {
          const res = await updateCategory(editingCatId, { name: catName.trim(), color: catColor });
          if (!res.success) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, name: catName.trim(), color: catColor } : c));
        } else {
          const res = await createCategory({ name: catName.trim(), color: catColor });
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante la creazione");
            return;
          }
          setCategories(prev => [...prev, res.data]);
        }
        resetCatForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEditCategory = (cat: ExpenseCategory) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatColor(cat.color);
  };

  const handleDeleteCategory = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa categoria?")) return;

    startTransition(async () => {
      try {
        const res = await deleteCategory(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setCategories(prev => prev.filter(c => c.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Impostazioni
          </h1>
          <p className="text-sm text-slate-400 mt-1">Personalizza le categorie di spesa e la sicurezza del tuo account.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-zinc-950/80 border border-white/10 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "categories" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            🏷️ Categorie Spesa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "security" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            🔒 Sicurezza Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "connections" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            🔗 Collegamenti
          </button>
        </div>
      </div>

      {/* Content Tab Categorie */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          
          {/* Form Categoria */}
          <div
            className="rounded-2xl p-6 border relative overflow-hidden shadow-2xl backdrop-blur-xl h-fit"
            style={{
              background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
              borderColor: "hsla(245, 60%, 50%, 0.15)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-4">
              {editingCatId ? "Modifica Categoria" : "Nuova Categoria"}
            </h2>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome Categoria</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="es. Ristoranti, Abbonamenti, Casa"
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Colore Badge</label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setCatColor(col.value)}
                      className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                        catColor === col.value ? "ring-2 ring-indigo-500 border-transparent scale-105" : "border-zinc-800"
                      }`}
                      style={{ backgroundColor: col.bg, color: col.text }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {editingCatId && (
                  <button
                    type="button"
                    onClick={resetCatForm}
                    className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700 transition-all"
                  >
                    Annulla
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
                >
                  {isPending ? "Salvataggio..." : editingCatId ? "Salva" : "Crea Categoria"}
                </button>
              </div>
            </form>
          </div>

          {/* Elenco Categorie */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h3 className="text-sm font-extrabold text-white mb-4">Elenco Categorie Configurate</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((cat) => {
                const colorObj = COLOR_OPTIONS.find(c => c.value === cat.color) || COLOR_OPTIONS[0];
                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between group"
                  >
                    <span
                      className="px-3 py-1 rounded-full text-xs font-extrabold border"
                      style={{ backgroundColor: colorObj.bg, color: colorObj.text, borderColor: colorObj.bg }}
                    >
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="p-1 rounded text-slate-400 hover:text-white transition-all"
                        title="Modifica"
                      >
                        <EditIcon size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 transition-all"
                        title="Elimina"
                      >
                        <DeleteIcon size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Content Tab Sicurezza */}
      {activeTab === "security" && (
        <div className="max-w-md mx-auto animate-fade-in">
          <div
            className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-4">Modifica Password Accesso</h2>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nuova Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Conferma Nuova Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all mt-2"
              >
                {isPending ? "Aggiornamento..." : "Aggiorna Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Content Tab Collegamenti */}
      {activeTab === "connections" && (
        <div className="max-w-md mx-auto animate-fade-in">
          <div
            className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-4">Account Google</h2>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Usato per caricare gli allegati su Google Drive e sincronizzare le scadenze su Google Calendar.
            </p>

            {googleConnected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-semibold flex items-center gap-2">
                  <span>✅</span> Account Google collegato
                </div>
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isPending}
                  className="w-full py-3 rounded-xl text-xs font-extrabold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                >
                  {isPending ? "Scollegamento..." : "Scollega Account Google"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-semibold flex items-center gap-2">
                  <span>⚠️</span> Nessun account Google collegato
                </div>
                <a
                  href="/api/google/connect?next=/dashboard/settings"
                  className="block text-center w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
                >
                  🔗 Collega Account Google
                </a>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
