"use client";

import { useTransition } from "react";
import { createProject } from "@/app/actions/projects";

export default function CreateProjectButton({ 
  className, 
  style, 
  children 
}: { 
  className?: string; 
  style?: React.CSSProperties; 
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => createProject())}
      disabled={isPending}
      className={className}
      style={style}
    >
      {isPending ? "Creazione..." : children}
    </button>
  );
}
