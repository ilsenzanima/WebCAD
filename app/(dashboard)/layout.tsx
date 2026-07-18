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
 * Verifica la sessione server-side e reindirizza se non autenticato.
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
      style={{ background: "hsl(222 47% 6%)" }}>
      
      {/* ─── Sidebar (solo desktop ≥ md) ───────────────────── */}
      <aside
        className="hidden md:flex w-64 flex-col flex-shrink-0 animate-slide-left"
        style={{
          background: "hsl(220 32% 10%)",
          borderRight: "1px solid hsl(220 20% 16%)",
          position: "relative",
          zIndex: 40,
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid hsl(220 20% 16%)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">💰</span>
            <div>
              <div className="text-white font-extrabold text-sm leading-tight">Finanza Privata</div>
              <div className="text-xs leading-tight" style={{ color: "hsl(215 15% 45%)" }}>
                Gestionale Spese
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav items={navItems} />

        {/* Bottom Nav */}
        <div className="px-3 pb-2 space-y-1" style={{ borderTop: "1px solid hsl(220 20% 16%)", paddingTop: "0.75rem" }}>
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeaderMenu 
          initials={initials} 
          userName={userName} 
          userEmail={user.email} 
        />

        {/* Contenuto pagina */}
        <main className="flex-1 overflow-y-auto pb-4 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
