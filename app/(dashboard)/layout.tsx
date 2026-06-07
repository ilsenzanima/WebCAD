import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/ui/dashboard/LogoutButton";
import MobileMenu from "@/app/ui/dashboard/MobileMenu";
import MobileHeaderMenu from "@/app/ui/dashboard/MobileHeaderMenu";
import UpdateNotifier from "@/app/ui/dashboard/UpdateNotifier";
import SidebarProfile from "@/app/ui/dashboard/SidebarProfile";
import GlobalCalcTrigger from "@/app/ui/dashboard/GlobalCalcTrigger";
import GlobalBollaTrigger from "@/app/ui/dashboard/GlobalBollaTrigger";
import GlobalRalTrigger from "@/app/ui/dashboard/GlobalRalTrigger";
import OfflineModeToggle from "@/app/ui/dashboard/OfflineModeToggle";
import SidebarNav from "@/app/ui/dashboard/SidebarNav";
import type { ReactNode } from "react";

const navItems = [
  { href: "/projects", icon: "📐", label: "Progetti" },
  { href: "/projects/istruzioni", icon: "🛠️", label: "Istruzioni Montaggio", isSubItem: true },
];

const bottomNavItems = [
  { href: "/settings", icon: "⚙️", label: "Impostazioni" },
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

    // Se l'utente non c'e', o c'è un errore grave, redirigiamo al log in
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
        
        {/* Rilevatore di aggiornamenti real-time */}
        <UpdateNotifier />

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
              <img
                src="/logo.svg"
                alt="WebCAD Logo"
                className="w-10 h-10 object-contain flex-shrink-0 select-none"
              />
              <div>
                <div className="text-white font-extrabold text-sm leading-tight">WebCAD</div>
                <div className="text-xs leading-tight" style={{ color: "hsl(215 15% 45%)" }}>
                  Antincendio
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <SidebarNav items={navItems} />

          {/* Bottom Nav (prima del profilo) */}
          <div className="px-3 pb-2 space-y-1" style={{ borderTop: "1px solid hsl(220 20% 16%)", paddingTop: "0.75rem" }}>
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "hsl(215 15% 40%)" }}>
              Strumenti
            </p>
            {/* Calcolatrice Globale in cima */}
            <GlobalCalcTrigger mode="desktop" />
            {/* Bolla Globale */}
            <GlobalBollaTrigger mode="desktop" />
            {/* Rilevatore RAL Globale */}
            <GlobalRalTrigger mode="desktop" />
            {/* Sincronizzazione */}
            <Link
              href="/sync"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: "hsl(215 20% 65%)" }}
            >
              <span className="text-base w-5 text-center font-bold">⇅</span>
              <span>Sincronizzazione</span>
            </Link>
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

          {/* Switch offline manuale */}
          <OfflineModeToggle />

          {/* Profilo & Notifiche di Aggiornamento */}
          <SidebarProfile 
            userName={userName}
            email={user.email || "Nessuna email"}
            initials={initials}
          />
        </aside>

        {/* ─── Main content ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHeaderMenu initials={initials} />

          {/* Contenuto pagina */}
          <main className="flex-1 overflow-y-auto pb-4 md:pb-0">
            {children}
          </main>
        </div>
      </div>
    );
}
