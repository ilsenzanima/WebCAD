"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Provider React Query per la gestione dello stato server-side.
 * Avvolge l'intera applicazione per abilitare il data fetching
 * con cache, refetch automatico e stato di loading/errore.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Impedisce il refetch automatico quando la finestra torna in focus
            refetchOnWindowFocus: false,
            // Tentativi di retry in caso di errore
            retry: 1,
            // Tempo di stale: 5 minuti
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
