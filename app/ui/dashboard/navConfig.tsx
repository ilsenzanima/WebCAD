import type { ReactNode } from "react";
import {
  OverviewIcon,
  ExpensesIcon,
  SettingsIcon,
  CalendarIcon,
  TagIcon,
  SupplierIcon,
  WalletIcon,
  InboxIcon,
} from "./icons";

export interface NavLink {
  type: "link";
  href: string;
  icon: ReactNode;
  label: string;
}

export interface NavGroup {
  type: "group";
  label: string;
  icon: ReactNode;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

// Navigazione principale: la Dashboard e il Calendario sono pensati per
// diventare condivisi con la famiglia, percio' restano voci di primo
// livello; le pagine finanziarie sono raggruppate sotto "Finanze" cosi'
// in futuro si potra' nascondere l'intero gruppo ai membri non admin.
export const navItems: NavEntry[] = [
  { type: "link", href: "/dashboard", icon: <OverviewIcon size={15} />, label: "Dashboard" },
  { type: "link", href: "/dashboard/calendar", icon: <CalendarIcon size={15} />, label: "Calendario" },
  { type: "link", href: "/dashboard/tracker-ragazzi", icon: <span style={{ fontSize: 14 }}>🧒</span>, label: "Tracker ragazzi" },
  {
    type: "group",
    label: "Spesa",
    icon: <span style={{ fontSize: 14 }}>🛒</span>,
    items: [
      { type: "link", href: "/dashboard/shopping-list", icon: <span style={{ fontSize: 13 }}>📝</span>, label: "Lista della spesa" },
      { type: "link", href: "/dashboard/shopping-catalog", icon: <span style={{ fontSize: 13 }}>🗂️</span>, label: "Vetrina prodotti" },
      { type: "link", href: "/dashboard/shopping-stores", icon: <span style={{ fontSize: 13 }}>🏬</span>, label: "Negozi" },
    ],
  },
  {
    type: "group",
    label: "Finanze",
    icon: <WalletIcon size={15} />,
    items: [
      { type: "link", href: "/dashboard/overview", icon: <OverviewIcon size={14} />, label: "Panoramica" },
      { type: "link", href: "/dashboard/accounts", icon: <WalletIcon size={14} />, label: "Conti" },
      { type: "link", href: "/dashboard/expenses", icon: <ExpensesIcon size={14} />, label: "Spese, Entrate e Scadenze" },
      { type: "link", href: "/dashboard/budget", icon: <TagIcon size={14} />, label: "Budget" },
      { type: "link", href: "/dashboard/suppliers", icon: <SupplierIcon size={14} />, label: "Fornitori" },
      { type: "link", href: "/dashboard/scansioni", icon: <InboxIcon size={14} />, label: "Smistamento Scansioni" },
    ],
  },
];

export const bottomNavItems: NavLink[] = [
  { type: "link", href: "/dashboard/settings", icon: <SettingsIcon size={15} />, label: "Impostazioni" },
];

export function isNavLinkActive(pathname: string | null, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname?.startsWith(href + "/") === true);
}
