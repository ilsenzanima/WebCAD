"use client";

import LogoutButton from "./LogoutButton";

interface SidebarProfileProps {
  userName: string;
  email: string;
  initials: string;
}

export default function SidebarProfile({ userName, email, initials }: SidebarProfileProps) {
  return (
    <div className="p-3 space-y-2" style={{ borderTop: "1px solid hsla(240, 5%, 18%, 0.4)" }}>
      {/* Profilo Utente */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 relative"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            {initials}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
              {userName}
            </div>
            <div className="text-[10px] truncate text-zinc-500">
              {email}
            </div>
          </div>
        </div>

        {/* Pulsante Logout integrato con stile grigi */}
        <LogoutButton
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors text-white/70 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
          style={{
            background: "hsl(240 10% 12%)",
            border: "1px solid hsl(240 5% 15%)",
          }}
          aria-label="Esci"
        >
          ↩
        </LogoutButton>
      </div>
    </div>
  );
}
