"use client";

import { useState, useTransition } from "react";
import { changePassword, logout } from "@/app/actions/auth";
import UnifiedSettingsManager from "./UnifiedSettingsManager";
import { APP_VERSION } from "@/lib/version";
import type { FieldNoteType } from "@/app/actions/field-notes";
import type { UserTag } from "@/app/actions/settings";

interface Props {
  user: {
    id: string;
    email?: string;
    fullName: string;
  };
  initialNoteTypes: FieldNoteType[];
  initialMaterialCategories: UserTag[];
  initialMaterialUnits: UserTag[];
}

export default function SettingsClient({
  user,
  initialNoteTypes,
  initialMaterialCategories,
  initialMaterialUnits,
}: Props) {
  const [activeTab, setActiveTab] = useState<"profile" | "config" | "mobile">("profile");
  const [isPending, startTransition] = useTransition();

  // Stati form cambio password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Tab per la visualizzazione delle impostazioni
  const tabs = [
    { key: "profile" as const, label: "Profilo & Sicurezza", icon: "👤" },
    { key: "config" as const, label: "Configurazione Voci", icon: "🏷️" },
    { key: "mobile" as const, label: "App Mobile (Download)", icon: "📲" },
  ];

  // Gestore cambio password
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 py-6">
      {/* Intestazione */}
      <div>
        <h1 className="text-2xl font-bold text-white">⚙️ Impostazioni Generali</h1>
        <p className="text-xs text-white/50">Gestisci il tuo profilo, configura l&apos;app e scarica la versione mobile per il cantiere (Versione Corrente: v{APP_VERSION}).</p>
      </div>

      {/* Selettore Schede Tab per Desktop */}
      <div className="hidden md:flex border-b border-white/10 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2"
              style={{
                borderColor: isSelected ? "hsl(220 90% 56%)" : "transparent",
                color: isSelected ? "white" : "white/50",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selettore Schede Tab per Mobile (Dropdown) */}
      <div className="block md:hidden space-y-1">
        <label className="text-[10px] font-bold uppercase text-white/40">Sezione Impostazioni</label>
        <div className="relative">
          <select
            value={activeTab}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full px-4 py-3.5 rounded-xl text-xs outline-none appearance-none transition-all pr-10 font-bold"
            style={{
              background: "hsl(220 26% 14%)",
              border: "1px solid hsl(220 20% 22%)",
              color: "white",
            }}
          >
            {tabs.map((tab) => (
              <option key={tab.key} value={tab.key} style={{ background: "hsl(220 32% 10%)" }}>
                {tab.icon} &nbsp; {tab.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-white/40 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* ─── TAB 1: PROFILO & SICUREZZA ────────────────── */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Card Dati Utente */}
          <div
            className="md:col-span-1 p-6 rounded-2xl border space-y-4"
            style={{
              background: "hsl(220 26% 14%)",
              borderColor: "hsl(220 20% 20%)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{user.fullName}</h3>
                <p className="text-xs text-white/40 truncate">{user.email}</p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => startTransition(() => logout())}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-xs font-semibold hover:bg-white/5 transition-all text-center flex items-center justify-center gap-2 border border-white/10 text-white/80"
              >
                <span>↩</span>
                <span>{isPending ? "Disconnessione..." : "Esci dall'Account"}</span>
              </button>
            </div>
          </div>

          {/* Form Cambio Password */}
          <div
            className="md:col-span-2 p-6 rounded-2xl border space-y-4"
            style={{
              background: "hsl(220 26% 14%)",
              borderColor: "hsl(220 20% 20%)",
            }}
          >
            <h3 className="text-sm font-bold text-white">🔐 Sicurezza & Cambio Password</h3>
            <p className="text-xs text-white/50 leading-relaxed">Aggiorna la tua password per proteggere il tuo account WebCAD.</p>

            {pwdError && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "hsl(0 70% 15%)", color: "hsl(0 80% 70%)" }}>
                ⚠️ {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "hsl(142 60% 12%)", color: "hsl(142 60% 75%)" }}>
                ✓ {pwdSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-white/40">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-white/40">Conferma Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !newPassword || !confirmPassword}
                className="w-full md:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {isPending ? "Aggiornamento..." : "Aggiorna Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CONFIGURAZIONE VOCI ───────────────── */}
      {activeTab === "config" && (
        <div className="animate-fade-in">
          <UnifiedSettingsManager
            initialNoteTypes={initialNoteTypes}
            initialMaterialCategories={initialMaterialCategories}
            initialMaterialUnits={initialMaterialUnits}
          />
        </div>
      )}

      {/* ─── TAB 3: APP MOBILE & DOWNLOAD ─────────────── */}
      {activeTab === "mobile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Box Download APK */}
          <div
            className="md:col-span-1 p-6 rounded-2xl border space-y-6 text-center"
            style={{
              background: "hsl(220 26% 14%)",
              borderColor: "hsl(220 20% 20%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div className="space-y-2">
              <div className="text-3xl">🤖</div>
              <div className="space-y-1">
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Applicativo Android</span>
                <h3 className="text-base font-bold">Android Package (.apk)</h3>
              </div>
            </div>

            <a
              href={`https://web-cad-lac.vercel.app/downloads/webcad-v${APP_VERSION}.apk`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor;
                if (isCapacitor) {
                  e.preventDefault();
                  window.open(`https://web-cad-lac.vercel.app/downloads/webcad-v${APP_VERSION}.apk`, "_system");
                }
              }}
              className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-xl font-bold text-xs text-white transition-all shadow-lg hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                boxShadow: "0 6px 20px hsl(220 90% 56% / 0.3)",
              }}
            >
              📥 Scarica APK v{APP_VERSION}
            </a>
            <p className="text-[10px] text-white/40">Dimensione: ~4.5 MB | Richiede Android 8.0+</p>

            <div className="border-t border-white/5 pt-4 text-center">
              <p className="text-[10px] text-white/40 mb-2">Sei su iPhone (iOS)?</p>
              <a
                href="mailto:dagostini.lorenzo@gmail.com?subject=Richiesta Invito TestFlight WebCAD"
                className="inline-flex items-center justify-center w-full py-2 px-4 rounded-lg font-semibold text-[10px] text-white/70 border border-white/10 hover:bg-white/5 transition-all"
              >
                🍎 Richiedi Invito TestFlight
              </a>
            </div>
          </div>

          {/* Guida all'installazione */}
          <div
            className="md:col-span-2 p-6 rounded-2xl border space-y-4 text-left"
            style={{
              background: "hsl(220 26% 14%)",
              borderColor: "hsl(220 20% 20%)",
            }}
          >
            <h3 className="text-sm font-bold text-white">📖 Guida all&apos;installazione su Android</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Segui questi passaggi per installare l&apos;app nativa di WebCAD sul tuo telefono ed abilitare i sensori di cantiere:
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex gap-3 text-xs">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                  style={{ background: "hsl(220 90% 56% / 0.2)", color: "hsl(220 90% 70%)" }}
                >
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-white">Scarica l&apos;APK</h4>
                  <p className="text-white/60 text-[11px] leading-relaxed">Clicca sul pulsante a sinistra dal tuo smartphone per scaricare il file d&apos;installazione.</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                  style={{ background: "hsl(220 90% 56% / 0.2)", color: "hsl(220 90% 70%)" }}
                >
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-white">Abilita le Origini Sconosciute</h4>
                  <p className="text-white/60 text-[11px] leading-relaxed">Durante l&apos;apertura del file, il telefono chiederà l&apos;autorizzazione all&apos;installazione. Consenti l&apos;installazione dalle impostazioni del browser.</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                  style={{ background: "hsl(220 90% 56% / 0.2)", color: "hsl(220 90% 70%)" }}
                >
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-white">Consenti i permessi dei sensori</h4>
                  <p className="text-white/60 text-[11px] leading-relaxed">Al primo avvio, l&apos;applicazione chiederà l&apos;accesso alla fotocamera (per le foto quotate) e ai sensori fisici (per la livella a bolla). Premi &apos;Consenti&apos;.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
