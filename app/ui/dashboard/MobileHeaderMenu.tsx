"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { OverviewIcon, ExpensesIcon, SchedulesIcon, SettingsIcon, CalendarIcon, TagIcon } from "./icons";

interface MobileHeaderMenuProps {
  initials: string;
  userName?: string;
  userEmail?: string;
}

export default function MobileHeaderMenu({ initials, userName, userEmail }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: <OverviewIcon size={14} />, label: "Panoramica" },
    { href: "/dashboard/expenses", icon: <ExpensesIcon size={14} />, label: "Spese" },
    { href: "/dashboard/schedules", icon: <SchedulesIcon size={14} />, label: "Scadenze" },
    { href: "/dashboard/calendar", icon: <CalendarIcon size={14} />, label: "Calendario" },
    { href: "/dashboard/budget", icon: <TagIcon size={14} />, label: "Budget" },
    { href: "/dashboard/settings", icon: <SettingsIcon size={14} />, label: "Impostazioni" },
  ];

  return (
    <>
      {/* ── Header Mobile ── */}
      <header
        className="md:hidden flex items-center justify-between px-4 flex-shrink-0 relative z-40"
        style={{
          height: 56,
          background: "hsla(240, 10%, 10%, 0.8)",
          borderBottom: "1px solid hsla(240, 5%, 18%, 0.5)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setIsOpen(true)}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white/80 hover:text-white transition-colors"
          aria-label="Apri menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        {/* Logo centrato */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-sm bg-zinc-900 border border-zinc-800 text-white">
            💰
          </div>
          <span className="text-white font-extrabold text-xs tracking-wide">Finanza Privata</span>
        </div>

        {/* Profilo */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
        >
          {initials}
        </div>
      </header>

      {/* ── Menu Drawer Mobile ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fade-in">
          {/* Overlay di sfondo */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Pannello menu */}
          <div
            className="relative flex flex-col w-4/5 max-w-xs h-full p-6 shadow-2xl animate-slide-left"
            style={{
              background: "hsla(240, 10%, 10%, 0.95)",
              borderRight: "1px solid hsla(240, 5%, 18%, 0.5)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Header Drawer */}
            <div className="flex justify-between items-center pb-5 mb-5 border-b" style={{ borderColor: "hsla(240, 5%, 18%, 0.4)" }}>
              <div className="flex items-center gap-2 select-none">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs bg-zinc-900 border border-zinc-800 text-white">
                  💰
                </div>
                <span className="text-white font-extrabold text-sm tracking-tight">Finanza Privata</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                style={{ background: "hsl(240 10% 4%)", border: "1px solid hsl(240 5% 15%)" }}
              >
                ✕
              </button>
            </div>

            {/* Navigazione */}
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition-all duration-150 text-xs"
                    style={{
                      background: active ? "rgba(59, 130, 246, 0.08)" : "transparent",
                      color: active ? "white" : "hsl(240 5% 65%)",
                    }}
                  >
                    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                      style={{ color: active ? "hsl(220 90% 56%)" : "inherit" }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profilo & Logout a fondo pagina */}
            <div className="pt-4 border-t space-y-4" style={{ borderColor: "hsla(240, 5%, 18%, 0.4)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-xs font-semibold truncate">{userName || "Utente"}</div>
                  <div className="text-[9px] truncate text-zinc-500">{userEmail || ""}</div>
                </div>
              </div>
              
              <LogoutButton
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-colors hover:text-white border border-zinc-800"
                style={{
                  background: "hsl(240 10% 12%)",
                  color: "hsl(0 80% 65%)",
                }}
              >
                Esci dall'account
              </LogoutButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
