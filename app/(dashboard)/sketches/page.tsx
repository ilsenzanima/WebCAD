import { createClient } from "@/lib/supabase/server";
import { getSketches } from "@/app/actions/sketches";
import SketchesClientPage from "@/app/ui/sketches/SketchesClientPage";

export const metadata = {
  title: "Sketch - WebCAD Antincendio",
  description: "Disegno a mano libera per note di cantiere",
};

export default async function SketchesPage() {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;

  // Carica gli sketch
  const sketches = await getSketches();

  // Carica i progetti (cantieri) con i relativi livelli (piani/note) per consentire l'associazione
  const { data: projectsData, error: projectsError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      levels:levels (
        id,
        name,
        piano
      )
    `)
    .order("name", { ascending: true });

  if (projectsError) {
    console.error("Errore recupero cantieri per sketch:", projectsError);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectsWithLevels = (projectsData ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    levels: (p.levels ?? []).sort((a: any, b: any) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA.localeCompare(nameB);
    }),
  }));

  return (
    <SketchesClientPage
      sketches={sketches}
      projectsWithLevels={projectsWithLevels}
    />
  );
}
