"use client";

import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";

interface SidebarProfileProps {
  userName: string;
  email: string;
  initials: string;
}

export default function SidebarProfile({ userName, email, initials }: SidebarProfileProps) {
  return (
    <div className="p-3 space-y-2" style={{ borderTop: "1px solid hsl(220 20% 16%)" }}>
      {/* Profilo Utente */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 relative"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            {initials}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
              {userName}
            </div>
            <div className="text-[10px] truncate" style={{ color: "hsl(215 15% 45%)" }}>
              {email}
            </div>
          </div>
        </div>

        {/* Nuova Campana Notifiche Integrata */}
        <NotificationBell mode="desktop" />
      </div>
    </div>
  );
}
