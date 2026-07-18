"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  icon: string;
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
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "hsl(215 15% 40%)" }}>
        Menu
      </p>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 py-2.5 rounded-xl font-medium transition-all duration-150 ${
              item.isSubItem ? "pl-8 text-[13px]" : "px-3 text-sm"
            }`}
            style={{
              background: active ? "hsla(220, 90%, 56%, 0.12)" : "transparent",
              color: active ? "hsl(220 90% 56%)" : "hsl(215 20% 65%)",
            }}
          >
            {item.isSubItem ? (
              <span className="text-gray-500 font-bold ml-1 mr-1">↳</span>
            ) : (
              <span className="text-base w-5 text-center">{item.icon}</span>
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
