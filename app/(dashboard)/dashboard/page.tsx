import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarIcon, WalletIcon } from "@/app/ui/dashboard/icons";

export const metadata = {
  title: "Dashboard - Finanza Privata",
  description: "Dashboard di famiglia",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Buonanotte";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const firstName = (user?.user_metadata?.full_name || user?.email?.split("@")[0] || "").split(" ")[0];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Questa è la nuova dashboard di famiglia: per ora è solo un abbozzo, presto qui troverete la lista della spesa condivisa, gli impegni e altro ancora.
        </p>
      </div>

      {/* Card rapide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
        <Link
          href="/dashboard/calendar"
          className="group rounded-2xl p-6 border shadow-2xl backdrop-blur-xl transition-all hover:border-zinc-600"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-indigo-500/10 text-indigo-300">
            <CalendarIcon size={18} />
          </div>
          <h3 className="text-sm font-extrabold text-white mb-1">Impegni di famiglia</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Il calendario condiviso oggi è collegato a Google; in futuro mostrerà qui gli impegni di tutta la famiglia.
          </p>
        </Link>

        <div
          className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl opacity-60"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-300 text-lg">
            🛒
          </div>
          <h3 className="text-sm font-extrabold text-white mb-1">Lista della spesa</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            Catalogo prodotti, lista condivisa e controllo scadenze. In arrivo.
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/5 text-zinc-400 border border-white/10">
            Presto disponibile
          </span>
        </div>

        <div
          className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl opacity-60"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-amber-500/10 text-amber-300 text-lg">
            🧒
          </div>
          <h3 className="text-sm font-extrabold text-white mb-1">Tracker ragazzi</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            Compiti, ricompense e attività dei figli. In arrivo.
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/5 text-zinc-400 border border-white/10">
            Presto disponibile
          </span>
        </div>

        <Link
          href="/dashboard/overview"
          className="group rounded-2xl p-6 border shadow-2xl backdrop-blur-xl transition-all hover:border-zinc-600"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-zinc-500/10 text-zinc-300">
            <WalletIcon size={18} />
          </div>
          <h3 className="text-sm font-extrabold text-white mb-1">Finanze</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Panoramica, conti, spese, budget e fornitori: tutta la parte finanziaria, in un unico posto.
          </p>
        </Link>
      </div>
    </div>
  );
}
