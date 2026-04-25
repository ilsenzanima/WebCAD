import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/ui/dashboard/LogoutButton";
import type { ReactNode } from "react";

const navItems = [
  { href: "/projects", icon: "📐", label: "Progetti" },
  { href: "/catalog", icon: "📦", label: "Catalogo" },
];

const bottomNavItems = [
  { href: "/catalog/tipi-appunto", icon: "🏷️", label: "Tipi Appunto" },
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

        {/* ─── Sidebar (solo desktop ≥ md) ───────────────────── */}
        <aside
          className="hidden md:flex w-64 flex-col flex-shrink-0 animate-slide-left"
          style={{
            background: "hsl(220 32% 10%)",
            borderRight: "1px solid hsl(220 20% 16%)",
          }}
        >
          {/* Logo */}
          <div className="px-5 py-5" style={{ borderBottom: "1px solid hsl(220 20% 16%)" }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}
              >
                🔥
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-tight">WebCAD</div>
                <div className="text-xs leading-tight" style={{ color: "hsl(215 15% 45%)" }}>
                  Antincendio
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "hsl(215 15% 40%)" }}>
              Menu
            </p>
            {navItems.map((item) => (
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
          </nav>

          {/* Bottom Nav (prima del profilo) */}
          <div className="px-3 pb-2 space-y-1" style={{ borderTop: "1px solid hsl(220 20% 16%)", paddingTop: "0.75rem" }}>
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "hsl(215 15% 40%)" }}>
              Configurazione
            </p>
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

          {/* User & Logout */}
          <div className="p-3 space-y-1" style={{ borderTop: "1px solid hsl(220 20% 16%)" }}>
            {/* User info */}
            <div className="flex items-center gap-3 px-3 py-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{userName}</div>
                <div className="text-xs truncate" style={{ color: "hsl(215 15% 45%)" }}>
                  {user.email || "Nessuna email"}
                </div>
              </div>
            </div>
            <LogoutButton
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
              style={{ color: "hsl(215 20% 55%)" }}
            >
              <span className="text-base">↩</span>
              <span>Esci</span>
            </LogoutButton>
          </div>
        </aside>

        {/* ─── Main content ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar (solo mobile) */}
          <header
            className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: "hsl(220 32% 10%)",
              borderBottom: "1px solid hsl(220 20% 16%)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}
              >
                🔥
              </div>
              <div className="text-white font-bold text-sm">WebCAD</div>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
            >
              {initials}
            </div>
          </header>

          {/* Contenuto pagina */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>

          {/* ─── Bottom Nav (solo mobile) ──────────────────────── */}
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2 z-50"
            style={{
              background: "hsl(220 32% 10%)",
              borderTop: "1px solid hsl(220 20% 16%)",
            }}
          >
            {[...navItems, ...bottomNavItems].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
                style={{ color: "hsl(215 20% 55%)" }}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            ))}
            <LogoutButton
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
              style={{ color: "hsl(215 20% 55%)" }}
            >
              <span className="text-xl leading-none">↩</span>
              <span className="text-[10px] font-medium leading-none">Esci</span>
            </LogoutButton>
          </nav>
        </div>
      </div>
    );
}
