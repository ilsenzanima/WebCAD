"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  icon: ReactNode;
  label: string;
  isSubItem?: boolean;
}

interface SidebarNavProps {
  items: NavItem[];
}

export default function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Menu principale
      </p>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 py-2.5 rounded-xl font-semibold transition-all duration-150 ${
              item.isSubItem ? "pl-8 text-[13px]" : "px-3 text-xs"
            }`}
            style={{
              background: active ? "rgba(59, 130, 246, 0.08)" : "transparent",
              color: active ? "white" : "hsl(240 5% 65%)",
              border: active ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid transparent",
            }}
          >
            {item.isSubItem ? (
              <span className="text-zinc-600 font-bold ml-1 mr-1">↳</span>
            ) : (
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors"
                style={{ color: active ? "hsl(220 90% 56%)" : "inherit" }}>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
