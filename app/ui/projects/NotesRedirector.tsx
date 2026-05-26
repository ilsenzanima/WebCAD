"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateLevelNote } from "@/app/actions/field-notes";

interface Props {
  projectId: string;
  levelId: string;
}

export default function NotesRedirector({ projectId, levelId }: Props) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const res = await getOrCreateLevelNote(projectId, levelId);
        if (!active) return;

        if (res.success && res.noteId) {
          router.replace(`/projects/${projectId}/levels/${levelId}/appunti/${res.noteId}/modifica`);
        } else {
          console.error("Errore nel recupero/creazione nota:", res.error);
          router.replace(`/projects/${projectId}`);
        }
      } catch (err) {
        console.error("Errore imprevisto nel reindirizzamento note:", err);
        if (active) {
          router.replace(`/projects/${projectId}`);
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [projectId, levelId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full text-white space-y-4 animate-pulse">
      <span className="text-4xl">📋</span>
      <p className="text-sm" style={{ color: "hsl(215 15% 55%)" }}>
        Apertura appunti di cantiere in corso...
      </p>
    </div>
  );
}
