"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isNavLinkActive, type NavEntry, type NavGroup, type NavLink as NavLinkEntry } from "./navConfig";

interface SidebarNavProps {
  items: NavEntry[];
}

export default function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Menu principale
      </p>
      {items.map((item) =>
        item.type === "group" ? (
          <NavGroupItem key={item.label} group={item} pathname={pathname} />
        ) : (
          <NavItemLink key={item.href} item={item} active={isNavLinkActive(pathname, item.href)} />
        )
      )}
    </nav>
  );
}

function NavItemLink({ item, active, isSubItem }: { item: NavLinkEntry; active: boolean; isSubItem?: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 py-2.5 rounded-xl font-semibold transition-all duration-150 ${
        isSubItem ? "pl-8 text-[13px]" : "px-3 text-xs"
      }`}
      style={{
        background: active ? "rgba(59, 130, 246, 0.08)" : "transparent",
        color: active ? "white" : "hsl(240 5% 65%)",
        border: active ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid transparent",
      }}
    >
      {isSubItem ? (
        <span className="text-zinc-600 font-bold ml-1 mr-1">↳</span>
      ) : (
        <span
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors"
          style={{ color: active ? "hsl(220 90% 56%)" : "inherit" }}
        >
          {item.icon}
        </span>
      )}
      <span>{item.label}</span>
    </Link>
  );
}

function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string | null }) {
  const hasActiveChild = group.items.some((child) => isNavLinkActive(pathname, child.href));
  const [expanded, setExpanded] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 hover:bg-white/2 hover:text-white"
        style={{ color: hasActiveChild ? "white" : "hsl(240 5% 65%)" }}
      >
        <span
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400"
          style={{ color: hasActiveChild ? "hsl(220 90% 56%)" : "inherit" }}
        >
          {group.icon}
        </span>
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded && (
        <div className="space-y-1 mt-1">
          {group.items.map((child) => (
            <NavItemLink key={child.href} item={child} active={isNavLinkActive(pathname, child.href)} isSubItem />
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-zinc-600 transition-transform duration-150"
      style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
