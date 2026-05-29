"use server";

export interface ExtractedItem {
  item_type: "base" | "altezza" | "spessore" | "lana_interna" | "dipintura" | "nota";
  value_num?: number | null;
  value_unit?: "cm" | "mm" | null;
  value_bool?: boolean | null;
  value_text?: string | null;
}

/**
 * Server Action per interpretare un dettato vocale di cantiere usando Google Gemini
 * ed estrarre misure ed attributi strutturati in modo sicuro.
 */
export async function interpretDettatoCantiere(
  text: string
): Promise<{ success: boolean; items?: ExtractedItem[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    // Fallback didattico se la chiave non è configurata, così l'app non crasha
    return { 
      success: false, 
      error: "La chiave GEMINI_API_KEY non è configurata nelle variabili d'ambiente di Vercel/.env.local." 
    };
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return { success: false, error: "Il testo inserito è vuoto." };
  }

  const prompt = `
Sei un assistente IA esperto in rilievi di cantiere e prevenzione incendi. Il tuo compito è analizzare il testo dettato a voce da un geometra in cantiere ed estrarre un elenco strutturato di misure e note.

Tipi di voce supportati da mappare:
- "base": Misura orizzontale (es. larghezza, base, spalla, larghezza porta). Converti sempre il valore numerico in CENTIMETRI (cm). Ad esempio: "un metro" -> value_num: 100, value_unit: "cm". "novanta centimetri" -> value_num: 90, value_unit: "cm".
- "altezza": Misura verticale (es. altezza, quota, altezza porta). Converti sempre il valore numerico in CENTIMETRI (cm).
- "spessore": Spessore (es. spessore muro, spessore spalla). Converti sempre in CENTIMETRI (cm).
- "lana_interna": Booleano (true/false) riferito alla presenza di lana di roccia o lana interna. Imposta value_bool: true se descritta come presente, o false se assente.
- "dipintura": Booleano riferito alla dipintura o verniciatura intumescente presente (true) o assente (false).
- "nota": Qualsiasi commento, appunto, dettaglio o anomalia riscontrata (es: "muro degradato", "manca il maniglione antipanico", "porta tagliafuoco REI 120").

Regole di conversione unità:
- Se la misura è espressa in metri (m), es: "due metri e dieci", convertila in centimetri -> 210.
- Se espressa in centimetri (cm), mantieni il numero.
- Se espressa in millimetri (mm), converti in centimetri dividendo per 10.

Restituisci ESCLUSIVAMENTE un array JSON valido, senza blocchi di codice markdown, senza spiegazioni, formattato esattamente come in questo schema:
[
  {
    "item_type": "base" | "altezza" | "spessore" | "lana_interna" | "dipintura" | "nota",
    "value_num": numero o null,
    "value_unit": "cm" o null,
    "value_bool": booleano o null,
    "value_text": "stringa di testo per la nota o null"
  }
]

Testo dettato da analizzare:
"${trimmedText}"
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Errore risposta Gemini:", errText);
      return { success: false, error: "Errore durante la comunicazione con Gemini." };
    }

    const resData = await response.json();
    const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return { success: false, error: "L'IA non ha restituito una risposta valida." };
    }

    // Parsiamo il JSON estratto da Gemini
    const items: ExtractedItem[] = JSON.parse(rawText.trim());
    return { success: true, items };
  } catch (err: any) {
    console.error("Errore Server Action Gemini:", err);
    return { success: false, error: err.message ?? "Errore sconosciuto di rete." };
  }
}
