"use client";

import { useState, useTransition } from "react";
import { changePassword, logout } from "@/app/actions/auth";

interface Props {
  user: {
    id: string;
    email?: string;
    fullName: string;
  };
}

export default function SettingsClient({ user }: Props) {
  const [isPending, startTransition] = useTransition();

  // Stati form cambio password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

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
        <h1 className="text-2xl font-bold text-white">⚙️ Impostazioni</h1>
        <p className="text-xs text-gray-400">Gestisci la sicurezza del tuo account e le impostazioni del profilo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
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
          <p className="text-xs text-gray-400 leading-relaxed">Aggiorna la tua password per proteggere il tuo account.</p>

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
              <label className="text-[10px] font-bold uppercase text-gray-400">Nuova Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nuova password..."
                className="w-full px-4 py-2.5 rounded-xl text-xs outline-none text-white focus:outline-none"
                style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)" }}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-400">Conferma Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ripeti la password..."
                className="w-full px-4 py-2.5 rounded-xl text-xs outline-none text-white focus:outline-none"
                style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)" }}
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
    </div>
  );
}
