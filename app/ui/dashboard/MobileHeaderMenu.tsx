"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { bottomNavItems, isNavLinkActive, type NavEntry, type NavGroup } from "./navConfig";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";

interface MobileHeaderMenuProps {
  initials: string;
  userName?: string;
  userEmail?: string;
  navItems: NavEntry[];
}

export default function MobileHeaderMenu({ initials, userName, userEmail, navItems }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<NavGroup | null>(null);
  const pathname = usePathname();

  const closeDrawer = () => {
    setIsOpen(false);
    setOpenGroup(null);
  };

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
            onClick={closeDrawer}
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
              {openGroup ? (
                <button
                  onClick={() => setOpenGroup(null)}
                  className="flex items-center gap-2 text-white font-extrabold text-sm"
                >
                  <ArrowLeftIcon size={14} className="text-zinc-400" />
                  <span className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{openGroup.icon}</span>
                    {openGroup.label}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 select-none">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs bg-zinc-900 border border-zinc-800 text-white">
                    💰
                  </div>
                  <span className="text-white font-extrabold text-sm tracking-tight">Finanza Privata</span>
                </div>
              )}
              <button
                onClick={closeDrawer}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                style={{ background: "hsl(240 10% 4%)", border: "1px solid hsl(240 5% 15%)" }}
              >
                ✕
              </button>
            </div>

            {/* Navigazione */}
            <nav className="flex-1 space-y-1">
              {openGroup ? (
                openGroup.items.map((item) => {
                  const active = isNavLinkActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDrawer}
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
                })
              ) : (
                <>
                  {navItems.map((entry) =>
                    entry.type === "group" ? (
                      <button
                        key={entry.label}
                        onClick={() => setOpenGroup(entry)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl font-bold transition-all duration-150 text-xs text-left"
                        style={{ color: "hsl(240 5% 65%)" }}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{entry.icon}</span>
                          <span>{entry.label}</span>
                        </span>
                        <ArrowRightIcon size={12} className="text-zinc-600" />
                      </button>
                    ) : (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition-all duration-150 text-xs"
                        style={{
                          background: isNavLinkActive(pathname, entry.href) ? "rgba(59, 130, 246, 0.08)" : "transparent",
                          color: isNavLinkActive(pathname, entry.href) ? "white" : "hsl(240 5% 65%)",
                        }}
                      >
                        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                          style={{ color: isNavLinkActive(pathname, entry.href) ? "hsl(220 90% 56%)" : "inherit" }}>
                          {entry.icon}
                        </span>
                        <span>{entry.label}</span>
                      </Link>
                    )
                  )}
                  {bottomNavItems.map((item) => {
                    const active = isNavLinkActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeDrawer}
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
                </>
              )}
            </nav>

            {/* Profilo & Logout a fondo pagina (solo nel menu generale) */}
            {!openGroup && (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
