/**
 * ============================================
 * Impostazioni globali dell'applicazione
 * ============================================
 * Contiene le costanti configurabili per il motore di nesting
 * e i parametri strutturali di default.
 */

/** Spessore lama di taglio in mm (parametro Kerf per il nesting) */
export const DEFAULT_BLADE_THICKNESS = 3;

/** Lunghezze commerciali standard per profili lineari (mm) */
export const STANDARD_PROFILE_LENGTHS = [3000, 4000, 6000];

/** Pitch strutturale di default per montanti (mm) */
export const DEFAULT_STUD_PITCH = 600;

/** Pitch massimo consentito prima di generare un warning (mm) */
export const MAX_STUD_PITCH = 650;

/** Impostazioni globali dell'app */
export interface SettingsGlobal {
  blade_thickness: number;
  standard_profile_lengths: number[];
  default_stud_pitch: number;
  max_stud_pitch: number;
}

export const defaultSettings: SettingsGlobal = {
  blade_thickness: DEFAULT_BLADE_THICKNESS,
  standard_profile_lengths: STANDARD_PROFILE_LENGTHS,
  default_stud_pitch: DEFAULT_STUD_PITCH,
  max_stud_pitch: MAX_STUD_PITCH,
};
