import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { levelId, text, typeName = "Calcolatrice" } = await request.json();

    if (!levelId || !text) {
      return NextResponse.json({ error: "Parametri levelId e text mancanti" }, { status: 400 });
    }

    // 1. Recupera il project_id associato al livello
    const { data: levelData, error: levelError } = await (supabase as any)
      .from("levels")
      .select("project_id")
      .eq("id", levelId)
      .single();

    if (levelError || !levelData) {
      console.error("Errore recupero livello:", levelError);
      return NextResponse.json({ error: "Livello non trovato" }, { status: 404 });
    }

    const projectId = (levelData as any).project_id;

    // 2. Trova o crea il tipo di appunto per il calcolo
    let typeId = null;
    const { data: typeData } = await (supabase as any)
      .from("field_note_types")
      .select("id")
      .eq("name", typeName)
      .eq("user_id", user.id)
      .maybeSingle();

    if (typeData) {
      typeId = (typeData as any).id;
    } else {
      // Creiamo il tipo al volo
      const { data: newType } = await (supabase as any)
        .from("field_note_types")
        .insert({ name: typeName, user_id: user.id })
        .select("id")
        .single();
      if (newType) typeId = (newType as any).id;
    }

    // 3. Calcola il note_number successivo per quel livello
    const { data: notes } = await (supabase as any)
      .from("field_notes")
      .select("note_number")
      .eq("level_id", levelId)
      .order("note_number", { ascending: false })
      .limit(1);

    const nextNumber = notes && notes.length > 0 ? (notes[0] as any).note_number + 1 : 1;

    // 4. Inserisce la nota di cantiere
    const { data: note, error: noteError } = await (supabase as any)
      .from("field_notes")
      .insert({
        project_id: projectId,
        level_id: levelId,
        user_id: user.id,
        note_number: nextNumber,
        type_id: typeId,
        type_name: typeName,
      })
      .select("id")
      .single();

    if (noteError || !note) {
      console.error("Errore creazione nota:", noteError);
      return NextResponse.json({ error: "Errore durante la creazione della nota" }, { status: 500 });
    }

    // 5. Inserisce l'item (voce) della nota di tipo 'nota'
    const { error: itemError } = await (supabase as any)
      .from("field_note_items")
      .insert({
        note_id: (note as any).id,
        item_type: "nota",
        value_text: text,
        sort_order: 0,
      });

    if (itemError) {
      console.error("Errore inserimento item nota:", itemError);
      return NextResponse.json({ error: "Errore durante l'inserimento del calcolo" }, { status: 500 });
    }

    return NextResponse.json({ success: true, noteId: note.id });
  } catch (err: any) {
    console.error("Errore generico API create-note-quick:", err);
    return NextResponse.json({ error: err.message ?? "Errore di server" }, { status: 500 });
  }
}
