import type { Project } from "@/lib/types/database";

export interface ProjectStatusMeta {
  value: Project["status"];
  label: string;
  icon: string;
  badgeClass: string;
}

export const PROJECT_STATUS_OPTIONS: ProjectStatusMeta[] = [
  { value: "bozza", label: "Bozza", icon: "📝", badgeClass: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30" },
  { value: "in_corso", label: "In corso", icon: "🔧", badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { value: "finito", label: "Finito", icon: "✅", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
];

export function getProjectStatusMeta(status: Project["status"]): ProjectStatusMeta {
  return PROJECT_STATUS_OPTIONS.find((s) => s.value === status) || PROJECT_STATUS_OPTIONS[0];
}
