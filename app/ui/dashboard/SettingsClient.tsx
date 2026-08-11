"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ExpenseCategory, type FamilyMember } from "@/lib/types/database";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";
import { changePassword } from "@/app/actions/auth";
import { disconnectGoogleDrive } from "@/app/actions/google";
import { setFontPreference } from "@/app/actions/preferences";
import { createFamilyMember, removeFamilyMember } from "@/app/actions/family";
import { FONT_OPTIONS } from "@/lib/fonts";
import { EditIcon, DeleteIcon } from "./icons";
import { CATEGORY_COLOR_TONES, getCategoryBadgeStyle } from "@/lib/categoryColors";

interface SettingsClientProps {
  categories: ExpenseCategory[];
  googleConnected: boolean;
  currentFontId: string;
  appVersion: { version: string; buildTime: string; notes: string };
  isAdmin: boolean;
  familyMembers: FamilyMember[];
}

// Ampia selezione di emoji pronte all'uso per le icone delle categorie,
// raggruppate per area tematica (casa, trasporti, cibo, salute, svago...).
const CATEGORY_EMOJIS = [
  "🏠", "🏡", "🔑", "🛋️", "🛠️", "🧹", "🧺", "💡", "💧", "🔥", "📶", "📱", "💻", "🪑",
  "🚗", "⛽", "🅿️", "🚌", "🚆", "🚲", "🛵", "✈️", "🏖️", "🧳", "🚕", "🛳️",
  "🛒", "🍽️", "☕", "🍕", "🍔", "🍎", "🍺", "🍷", "🎂", "🧁",
  "💊", "🏥", "🩺", "🦷", "👓", "💉", "🧘", "💪", "🏋️",
  "🎮", "🎬", "🎵", "📚", "🎓", "🎨", "🎉", "🎁", "🎯", "📷", "⚽", "🏀",
  "👕", "👗", "👟", "💇", "💅", "💄",
  "👶", "🧸", "🐾", "🌳", "🌱", "🐶", "🐱",
  "💼", "💰", "🏦", "💳", "📈", "📉", "🧾", "⚖️", "🛡️", "❤️", "🎗️", "🤝",
  "📦", "➕", "❓", "⭐",
];

// Individua un emoji iniziale gia' presente nel nome (es. "🏠 Casa") cosi'
// da poterlo sostituire con un click invece di accumularne diversi in fila.
const LEADING_EMOJI_REGEX = /^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*\s*)/u;

export default function SettingsClient({ categories: initialCategories, googleConnected: initialGoogleConnected, currentFontId, appVersion, isAdmin, familyMembers: initialFamilyMembers }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"security" | "categories" | "connections" | "appearance" | "app" | "family">("categories");
  const [isPending, startTransition] = useTransition();
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const [selectedFontId, setSelectedFontId] = useState(currentFontId);
  const [isSavingFont, setIsSavingFont] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelectFont = (fontId: string) => {
    setSelectedFontId(fontId);
    setIsSavingFont(true);
    startTransition(async () => {
      try {
        const res = await setFontPreference(fontId);
        if (!res.success) {
          alert(res.error || "Errore durante il salvataggio del font");
          return;
        }
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio del font");
      } finally {
        setIsSavingFont(false);
      }
    });
  };

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

  // Famiglia state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialFamilyMembers);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

  const resetMemberForm = () => {
    setMemberName("");
    setMemberEmail("");
    setMemberPassword("");
    setMemberRole("member");
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim() || memberPassword.length < 6) {
      alert("Compila nome, email e una password di almeno 6 caratteri.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createFamilyMember({
          full_name: memberName.trim(),
          email: memberEmail.trim(),
          password: memberPassword,
          role: memberRole,
        });
        if (!res.success) {
          alert(res.error || "Errore durante la creazione dell'account");
          return;
        }
        alert(
          res.needsConfirmation
            ? "Account creato. Dovrà confermare l'email ricevuta prima di poter accedere."
            : "Account creato: comunica email e password inserite al familiare."
        );
        router.refresh();
        resetMemberForm();
      } catch (err: any) {
        alert(err.message || "Errore durante la creazione dell'account");
      }
    });
  };

  const handleRemoveMember = (member: FamilyMember) => {
    if (!confirm(`Rimuovere ${member.display_name} dalla famiglia? Non vedrà più gli strumenti condivisi.`)) return;

    startTransition(async () => {
      try {
        const res = await removeFamilyMember(member.user_id);
        if (!res.success) {
          alert(res.error || "Errore durante la rimozione");
          return;
        }
        setFamilyMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      } catch (err: any) {
        alert(err.message || "Errore durante la rimozione");
      }
    });
  };

  // Categories state
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("indigo");
  // Colore del testo del badge, se diverso dallo sfondo: vuoto = stesso colore dello sfondo (badge monocromo, come sempre).
  const [catTextColor, setCatTextColor] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const resetCatForm = () => {
    setCatName("");
    setCatColor("indigo");
    setCatTextColor("");
    setEditingCatId(null);
  };

  const insertCategoryEmoji = (emoji: string) => {
    setCatName(prev => `${emoji} ${prev.replace(LEADING_EMOJI_REGEX, "")}`.trimEnd());
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

    // Se il colore del testo scelto e' diverso dallo sfondo, salva la combinazione "sfondo:testo";
    // altrimenti salva solo lo sfondo come tinta unica (formato monocromo di sempre).
    const finalColor = catTextColor && catTextColor !== catColor ? `${catColor}:${catTextColor}` : catColor;

    startTransition(async () => {
      try {
        if (editingCatId) {
          const res = await updateCategory(editingCatId, { name: catName.trim(), color: finalColor });
          if (!res.success) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, name: catName.trim(), color: finalColor } : c));
        } else {
          const res = await createCategory({ name: catName.trim(), color: finalColor });
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
    const [bgPart, textPart] = (cat.color || "indigo").split(":");
    setCatColor(bgPart);
    setCatTextColor(textPart && textPart !== bgPart ? textPart : "");
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

  const catPreviewColor = catTextColor && catTextColor !== catColor ? `${catColor}:${catTextColor}` : catColor;
  const catPreviewStyle = getCategoryBadgeStyle(catPreviewColor);

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
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "appearance" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            🎨 Aspetto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("app")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "app" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            📱 App Mobile
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("family")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "family" ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"
              }`}
            >
              👪 Famiglia
            </button>
          )}
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
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Icona (Emoji)</label>
                <div className="grid grid-cols-8 gap-1 p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 max-h-32 overflow-y-auto">
                  {CATEGORY_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertCategoryEmoji(emoji)}
                      className="aspect-square flex items-center justify-center rounded-lg text-base hover:bg-white/10 transition-all active:scale-90"
                      title={`Usa ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-500">Scegli un'icona: verrà aggiunta all'inizio del nome della categoria.</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Colore Sfondo</label>
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    style={{ backgroundColor: catPreviewStyle.bg, color: catPreviewStyle.text, borderColor: catPreviewStyle.border }}
                  >
                    {catName.trim() || "Anteprima"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_COLOR_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setCatColor(tone.value)}
                      className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                        catColor === tone.value ? "ring-2 ring-indigo-500 border-transparent scale-105" : "border-zinc-800"
                      }`}
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Colore Testo (opzionale)</label>
                <p className="text-[9px] text-zinc-500 -mt-0.5">Per un badge a due colori, es. sfondo ambra con testo indaco.</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setCatTextColor("")}
                    className={`py-2 rounded-xl text-[9px] font-bold border transition-all text-zinc-300 bg-zinc-950/80 ${
                      catTextColor === "" ? "ring-2 ring-indigo-500 border-transparent scale-105" : "border-zinc-800"
                    }`}
                  >
                    Uguale
                  </button>
                  {CATEGORY_COLOR_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setCatTextColor(tone.value)}
                      className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                        catTextColor === tone.value ? "ring-2 ring-indigo-500 border-transparent scale-105" : "border-zinc-800"
                      }`}
                      style={{ backgroundColor: "hsl(240 10% 4% / 0.8)", color: tone.text }}
                    >
                      {tone.label}
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
                const colorObj = getCategoryBadgeStyle(cat.color);
                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between group"
                  >
                    <span
                      className="px-3 py-1 rounded-full text-xs font-extrabold border"
                      style={{ backgroundColor: colorObj.bg, color: colorObj.text, borderColor: colorObj.border }}
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

      {/* Content Tab Aspetto */}
      {activeTab === "appearance" && (
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div
            className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-1">Font dell'interfaccia</h2>
            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
              Scegli il font con cui viene scritto tutto il gestionale. Ogni opzione mostra un'anteprima dal vivo.
            </p>

            <div className="space-y-3">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => handleSelectFont(font.id)}
                  disabled={isSavingFont}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedFontId === font.id
                      ? "bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/40"
                      : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      {font.label}
                      {selectedFontId === font.id && <span className="text-indigo-400">✓ Attivo</span>}
                    </span>
                  </div>
                  <p
                    className="text-lg text-white leading-snug"
                    style={{ fontFamily: `var(${font.cssVar})` }}
                  >
                    Fammi sapere quale opzione provi — 0123456789
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1.5">{font.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content Tab App Mobile */}
      {activeTab === "app" && (
        <div className="max-w-md mx-auto animate-fade-in">
          <div
            className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-1">Scarica l'app Android</h2>
            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
              Versione installabile per il telefono, generata automaticamente ad ogni aggiornamento del sito.
            </p>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-slate-300 mb-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Versione</span>
                <span className="font-bold text-white">{appVersion.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Ultimo aggiornamento</span>
                <span className="font-semibold">
                  {new Date(appVersion.buildTime).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            <a
              href="/downloads/webcad-alpha.apk"
              download
              className="block text-center w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
            >
              ⬇️ Scarica APK
            </a>

            <div className="mt-5 space-y-2 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-bold text-zinc-300">Come installarla:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Apri il link dal telefono (o scarica il file e aprilo dai Download).</li>
                <li>Se compare un avviso, consenti l'installazione da questa origine quando richiesto.</li>
                <li>Conferma l'installazione: essendo una build di test, Android potrebbe segnalarla come app sconosciuta.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Content Tab Famiglia */}
      {isAdmin && activeTab === "family" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">

          {/* Form Nuovo Membro */}
          <div
            className="rounded-2xl p-6 border relative overflow-hidden shadow-2xl backdrop-blur-xl h-fit"
            style={{
              background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
              borderColor: "hsla(245, 60%, 50%, 0.15)",
            }}
          >
            <h2 className="text-base font-extrabold text-white mb-1">Aggiungi un familiare</h2>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Scegli tu email e password: comunicale poi al familiare. Un "membro" non vede la sezione Finanze, un "admin" sì.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="es. Giulia"
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="familiare@esempio.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Password provvisoria</label>
                <input
                  type="text"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Almeno 6 caratteri"
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ruolo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberRole("member")}
                    className={`py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                      memberRole === "member" ? "ring-2 ring-indigo-500 border-transparent bg-indigo-500/10 text-white" : "border-zinc-800 text-zinc-400"
                    }`}
                  >
                    Membro
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberRole("admin")}
                    className={`py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                      memberRole === "admin" ? "ring-2 ring-indigo-500 border-transparent bg-indigo-500/10 text-white" : "border-zinc-800 text-zinc-400"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all mt-2"
              >
                {isPending ? "Creazione..." : "Crea account"}
              </button>
            </form>
          </div>

          {/* Elenco Famiglia */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <h3 className="text-sm font-extrabold text-white mb-4">Membri della famiglia</h3>
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
                    >
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{member.display_name}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        {member.role === "admin" ? "Admin" : "Membro"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member)}
                    disabled={isPending}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                    title="Rimuovi dalla famiglia"
                  >
                    <DeleteIcon size={13} />
                  </button>
                </div>
              ))}
              {familyMembers.length === 0 && (
                <p className="text-[11px] text-zinc-500">Nessun familiare ancora aggiunto.</p>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
