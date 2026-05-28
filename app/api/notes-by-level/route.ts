import { NextRequest, NextResponse } from "next/server";
import { getFieldNotes } from "@/app/actions/field-notes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get("levelId");

    if (!levelId) {
      return NextResponse.json({ error: "Missing levelId parameter" }, { status: 400 });
    }

    const notes = await getFieldNotes(levelId);
    return NextResponse.json(notes);
  } catch (err: any) {
    console.error("Errore recupero API appunti per livello:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
