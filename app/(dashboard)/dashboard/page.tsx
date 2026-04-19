import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

/**
 * Dashboard principale — mostra solo un benvenuto e accesso rapido ai progetti attivi.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  const firstName = userName.split(" ")[0] || "Utente";

  // Solo conteggio progetti attivi
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Ciao, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(215 20% 55%)" }}>
          Bentornato su WebCAD Antincendio
        </p>
      </div>

      {/* Card progetti attivi */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 90% 56% / 0.2), hsl(215 85% 48% / 0.2))",
              border: "1px solid hsl(220 90% 56% / 0.3)",
            }}
          >
            📐
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {projectCount ?? 0}
            </div>
            <div className="text-sm mt-0.5" style={{ color: "hsl(215 20% 55%)" }}>
              Progetti attivi
            </div>
          </div>
        </div>

        <Link
          href="/projects"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
          }}
        >
          Vai ai Progetti →
        </Link>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/projects"
          className="flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 group"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 20%)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "hsl(220 32% 20%)" }}
          >
            📐
          </div>
          <div>
            <div className="text-white font-medium text-sm">I miei Progetti</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(215 15% 45%)" }}>
              Gestisci e crea progetti CAD
            </div>
          </div>
          <span
            className="ml-auto text-lg opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
            style={{ color: "hsl(215 20% 65%)" }}
          >
            →
          </span>
        </Link>

        <Link
          href="/catalog"
          className="flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 group"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 20%)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "hsl(220 32% 20%)" }}
          >
            📦
          </div>
          <div>
            <div className="text-white font-medium text-sm">Catalogo Materiali</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(215 15% 45%)" }}>
              Gestisci materiali e componenti
            </div>
          </div>
          <span
            className="ml-auto text-lg opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
            style={{ color: "hsl(215 20% 65%)" }}
          >
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
