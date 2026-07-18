import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MobileHeaderMenu from "@/app/ui/dashboard/MobileHeaderMenu";
import SidebarProfile from "@/app/ui/dashboard/SidebarProfile";
import SidebarNav from "@/app/ui/dashboard/SidebarNav";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", icon: "📊", label: "Panoramica" },
  { href: "/dashboard/expenses", icon: "💸", label: "Spese" },
  { href: "/dashboard/schedules", icon: "📅", label: "Pagamenti" },
];

const bottomNavItems = [
  { href: "/dashboard/settings", icon: "⚙️", label: "Impostazioni" },
];

/**
 * Layout principale della dashboard con sidebar.
 * Vetro e trasparenza per un design modernissimo.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Se l'utente non c'è, o c'è un errore grave, redirigiamo al login
  if (!user || authError) redirect("/login");

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  
  // Fallback sicuro se lo split fallisce
  const splitName = userName.split(" ");
  const initialsArray = splitName.map((n: string) => n?.[0] || "");
  const initials = initialsArray.join("").toUpperCase().slice(0, 2) || "U";

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(222 47% 4%), hsl(222 47% 8%))" }}>
      
      {/* ─── Sidebar (solo desktop ≥ md) ───────────────────── */}
      <aside
        className="hidden md:flex w-64 flex-col flex-shrink-0 animate-slide-left relative overflow-hidden"
        style={{
          background: "hsla(220, 32%, 10%, 0.8)",
          borderRight: "1px solid hsla(220, 20%, 16%, 0.5)",
          backdropFilter: "blur(20px)",
          zIndex: 40,
        }}
      >
        {/* Cerchio di luce d'accento nella sidebar */}
        <div className="absolute top-[-10%] left-[-20%] w-40 h-40 rounded-full bg-blue-500/5 blur-[50px] pointer-events-none" />

        {/* Logo */}
        <div className="px-6 py-6 relative" style={{ borderBottom: "1px solid hsla(220, 20%, 16%, 0.4)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-gradient-to-br from-indigo-500 to-blue-600 select-none">
              💰
            </div>
            <div>
              <div className="text-white font-extrabold text-sm leading-tight tracking-wide">Finanza Privata</div>
              <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "hsl(215 15% 45%)" }}>
                Gestionale
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav items={navItems} />

        {/* Bottom Nav */}
        <div className="px-3 pb-2 space-y-1" style={{ borderTop: "1px solid hsla(220, 20%, 16%, 0.4)", paddingTop: "0.75rem" }}>
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 hover:bg-white/2 hover:text-white"
              style={{ color: "hsl(215 20% 65%)" }}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Profilo */}
        <SidebarProfile 
          userName={userName}
          email={user.email || "Nessuna email"}
          initials={initials}
        />
      </aside>

      {/* ─── Main content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Decorazione di luce d'accento in alto a destra nel main */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none z-0" />

        <MobileHeaderMenu 
          initials={initials} 
          userName={userName} 
          userEmail={user.email} 
        />

        {/* Contenuto pagina */}
        <main className="flex-1 overflow-y-auto pb-4 md:pb-0 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
