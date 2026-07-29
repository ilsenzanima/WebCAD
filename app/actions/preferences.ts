"use server";

import { cookies } from "next/headers";
import { isValidFontId, DEFAULT_FONT_ID } from "@/lib/fonts";

const FONT_COOKIE_NAME = "font-preference";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setFontPreference(fontId: string) {
  try {
    const id = isValidFontId(fontId) ? fontId : DEFAULT_FONT_ID;
    const cookieStore = await cookies();
    cookieStore.set(FONT_COOKIE_NAME, id, {
      maxAge: ONE_YEAR,
      path: "/",
      sameSite: "lax",
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il salvataggio della preferenza" };
  }
}
