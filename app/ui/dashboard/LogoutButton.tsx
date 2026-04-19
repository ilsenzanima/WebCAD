"use client";

import { useTransition } from "react";
import { logout } from "@/app/actions/auth";

export default function LogoutButton({ 
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
      onClick={() => startTransition(() => logout())}
      disabled={isPending}
      className={className}
      style={style}
    >
      {isPending ? "Uscita..." : children}
    </button>
  );
}
