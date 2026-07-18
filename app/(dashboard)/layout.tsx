import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MobileHeaderMenu from "@/app/ui/dashboard/MobileHeaderMenu";
import SidebarProfile from "@/app/ui/dashboard/SidebarProfile";
import SidebarNav from "@/app/ui/dashboard/SidebarNav";
import { OverviewIcon, ExpensesIcon, SchedulesIcon, SettingsIcon } from "@/app/ui/dashboard/icons";
import type { ReactNode } from "react";

// Configurazione voci menu con le nuove icone SVG
const navItems = [
  { href: "/dashboard", icon: <OverviewIcon size={15} />, label: "Panoramica" },
  { href: "/dashboard/expenses", icon: <ExpensesIcon size={15} />, label: "Spese" },
  { href: "/dashboard/schedules", icon: <SchedulesIcon size={15} />, label: "Pagamenti" },
];

const bottomNavItems = [
  { href: "/dashboard/settings", icon: <SettingsIcon size={15} />, label: "Impostazioni" },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) redirect("/login");

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  
  const splitName = userName.split(" ");
  const initialsArray = splitName.map((n: string) => n?.[0] || "");
  const initials = initialsArray.join("").toUpperCase().slice(0, 2) || "U";

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(240 10% 4%), hsl(240 10% 8%))" }}>
      
      {/* ─── Sidebar (solo desktop ≥ md) ───────────────────── */}
      <aside
        className="hidden md:flex w-60 flex-col flex-shrink-0 animate-slide-left relative overflow-hidden"
        style={{
          background: "hsla(240, 10%, 10%, 0.8)",
          borderRight: "1px solid hsla(240, 5%, 18%, 0.5)",
          backdropFilter: "blur(20px)",
          zIndex: 40,
        }}
      >
        {/* Cerchio di luce d'accento zinc */}
        <div className="absolute top-[-10%] left-[-20%] w-40 h-40 rounded-full bg-zinc-400/5 blur-[50px] pointer-events-none" />

        {/* Logo */}
        <div className="px-6 py-6 relative" style={{ borderBottom: "1px solid hsla(240, 5%, 18%, 0.4)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-[0_0_20px_rgba(255,255,255,0.05)] bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 text-white select-none">
              💰
            </div>
            <div>
              <div className="text-white font-extrabold text-xs leading-tight tracking-wide">Finanza Privata</div>
              <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-zinc-500">
                Gestionale
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav items={navItems} />

        {/* Bottom Nav */}
        <div className="px-3 pb-2 space-y-1" style={{ borderTop: "1px solid hsla(240, 5%, 18%, 0.4)", paddingTop: "0.75rem" }}>
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 hover:bg-white/2 hover:text-white"
              style={{ color: "hsl(240 5% 65%)" }}
            >
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400">{item.icon}</span>
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
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-zinc-500/5 blur-[120px] pointer-events-none z-0" />

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
