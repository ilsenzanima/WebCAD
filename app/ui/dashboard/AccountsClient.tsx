"use client";

import { useState, useTransition, useMemo } from "react";
import { type Account } from "@/lib/types/database";
import { createAccount, updateAccount, deleteAccount } from "@/app/actions/accounts";
import { formatCurrency } from "@/lib/format";
import { EditIcon, DeleteIcon, WalletIcon } from "./icons";

interface AccountsClientProps {
  initialAccounts: Account[];
  expenses: any[];
}

const TYPE_LABELS: Record<Account["type"], string> = {
  checking: "Conto Corrente",
  savings: "Risparmio",
  cash: "Contanti",
  credit_card: "Carta di Credito",
  other: "Altro",
};

const TYPE_ICONS: Record<Account["type"], string> = {
  checking: "🏦",
  savings: "🐷",
  cash: "💵",
  credit_card: "💳",
  other: "📦",
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  rose: { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  emerald: { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  sky: { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  pink: { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  purple: { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  slate: { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
  red: { bg: "rgba(220,38,38,0.12)", text: "hsl(0 74% 72%)", border: "rgba(220,38,38,0.2)" },
  orange: { bg: "rgba(249,115,22,0.12)", text: "hsl(24 94% 70%)", border: "rgba(249,115,22,0.2)" },
  yellow: { bg: "rgba(234,179,8,0.12)", text: "hsl(45 90% 65%)", border: "rgba(234,179,8,0.2)" },
  lime: { bg: "rgba(132,204,22,0.12)", text: "hsl(83 70% 65%)", border: "rgba(132,204,22,0.2)" },
  green: { bg: "rgba(34,197,94,0.12)", text: "hsl(142 65% 65%)", border: "rgba(34,197,94,0.2)" },
  teal: { bg: "rgba(20,184,166,0.12)", text: "hsl(173 65% 62%)", border: "rgba(20,184,166,0.2)" },
  cyan: { bg: "rgba(6,182,212,0.12)", text: "hsl(189 80% 65%)", border: "rgba(6,182,212,0.2)" },
  blue: { bg: "rgba(59,130,246,0.12)", text: "hsl(217 85% 72%)", border: "rgba(59,130,246,0.2)" },
  violet: { bg: "rgba(139,92,246,0.12)", text: "hsl(258 85% 75%)", border: "rgba(139,92,246,0.2)" },
  fuchsia: { bg: "rgba(217,70,239,0.12)", text: "hsl(292 80% 72%)", border: "rgba(217,70,239,0.2)" },
};

export default function AccountsClient({ initialAccounts, expenses }: AccountsClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("checking");
  const [initialBalance, setInitialBalance] = useState("0");
  const [color, setColor] = useState("sky");
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setType("checking");
    setInitialBalance("0");
    setColor("sky");
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Inserisci il nome del conto");
      return;
    }
    if (initialBalance === "" || isNaN(Number(initialBalance))) {
      alert("Inserisci un saldo iniziale valido");
      return;
    }

    startTransition(async () => {
      try {
        const payload = { name: name.trim(), type, initial_balance: Number(initialBalance), color };

        if (editingId) {
          const res = await updateAccount(editingId, { ...payload, is_active: true });
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setAccounts(prev => prev.map(a => a.id === editingId ? res.data : a));
        } else {
          const res = await createAccount(payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante la creazione");
            return;
          }
          setAccounts(prev => [...prev, res.data]);
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(String(acc.initial_balance));
    setColor(acc.color);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Eliminare questo conto? Le spese/entrate collegate resteranno ma perderanno il collegamento.")) return;

    startTransition(async () => {
      try {
        const res = await deleteAccount(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setAccounts(prev => prev.filter(a => a.id !== id));
        if (editingId === id) resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Saldo corrente per conto: saldo iniziale + entrate collegate - uscite collegate
  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.id] = Number(a.initial_balance); });
    expenses.forEach((e: any) => {
      if (!e.account_id || !(e.account_id in map)) return;
      map[e.account_id] += e.is_income ? Number(e.amount) : -Number(e.amount);
    });
    return map;
  }, [accounts, expenses]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (balances[a.id] ?? Number(a.initial_balance)), 0),
    [accounts, balances]
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Conti
          </h1>
          <p className="text-sm text-slate-400 mt-1">Tieni traccia del saldo reale dei tuoi conti, non solo del totale entrate/uscite.</p>
        </div>
      </div>

      {/* Saldo Totale */}
      <div
        className="rounded-2xl p-6 border relative overflow-hidden shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
          borderColor: "hsla(200, 60%, 50%, 0.15)",
        }}
      >
        <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-sky-500/5 blur-[50px] pointer-events-none" />
        <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Saldo Totale Complessivo</h4>
        <p className={`text-3xl font-black mt-2 ${totalBalance >= 0 ? "text-white" : "text-rose-400"}`}>
          {formatCurrency(totalBalance)}
        </p>
        <div className="text-[9px] text-slate-500 mt-1 font-semibold">Somma dei saldi di tutti i conti attivi</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Form Creazione / Modifica */}
        <div
          className="rounded-2xl p-6 border relative overflow-hidden group shadow-2xl backdrop-blur-xl animate-fade-in h-fit"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(200, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-sky-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span className="text-sky-400"><WalletIcon size={16} /></span>
            {editingId ? "Modifica Conto" : "Nuovo Conto"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome Conto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Conto Corrente, Contanti"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Account["type"])}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom border-zinc-800 bg-zinc-950/80"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} style={{ background: "hsl(240 10% 10%)" }}>
                    {TYPE_ICONS[value as Account["type"]]} {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {editingId ? "Saldo Iniziale (non modifica il saldo corrente calcolato)" : "Saldo Attuale di Partenza (€)"}
              </label>
              <input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Colore Badge</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(COLOR_MAP).map(([value, col]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setColor(value)}
                    className={`py-2 rounded-xl text-[9px] font-bold border transition-all ${
                      color === value ? "ring-2 ring-sky-500 border-transparent scale-105" : "border-zinc-800"
                    }`}
                    style={{ backgroundColor: col.bg, color: col.text }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700 transition-all"
                >
                  Annulla
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all disabled:opacity-50"
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Crea Conto"}
              </button>
            </div>
          </form>
        </div>

        {/* Elenco Conti */}
        <div className="lg:col-span-2 space-y-4">
          {accounts.length === 0 ? (
            <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60">
              <span className="text-3xl block mb-2">💳</span>
              <p className="text-xs">Nessun conto ancora tracciato. Aggiungi il tuo primo conto dal modulo a sinistra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const badge = COLOR_MAP[acc.color] || COLOR_MAP.sky;
                const balance = balances[acc.id] ?? Number(acc.initial_balance);

                return (
                  <div
                    key={acc.id}
                    className="rounded-2xl p-5 border flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden group backdrop-blur-xl transition-all duration-300 hover:border-sky-500/30"
                    style={{
                      background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.6), hsla(240, 10%, 10%, 0.8))",
                      borderColor: "hsla(240, 5%, 18%, 0.7)",
                    }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                            <span>{TYPE_ICONS[acc.type]}</span> {acc.name}
                          </h3>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border mt-1"
                            style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
                          >
                            {TYPE_LABELS[acc.type]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(acc)}
                            className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                            title="Modifica"
                          >
                            <EditIcon size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(acc.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Elimina"
                          >
                            <DeleteIcon size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800/60">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Saldo Corrente</span>
                        <span className={`text-xl font-black ${balance >= 0 ? "text-white" : "text-rose-400"}`}>
                          {formatCurrency(balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
