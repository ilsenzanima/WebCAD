/**
 * Parsing dell'estratto conto in CSV esportato dal sito della banca. Il formato
 * esatto (delimitatore, decimale, nomi di colonna) varia da banca a banca: il
 * parser individua da solo la riga di intestazione cercando le colonne "Data" e
 * "Importo" tra quelle note, cosi' da ignorare eventuali righe di preambolo. Se
 * una banca usa colonne o un formato non ancora previsto, vanno aggiunti qui.
 */

export interface ParsedStatementRow {
  transactionDate: string; // ISO yyyy-mm-dd, data di contabilizzazione ("Data")
  valueDate: string; // ISO yyyy-mm-dd, data valuta ("Valuta"), = transactionDate se assente
  amount: number; // negativo per le uscite, come nell'estratto conto
  type: string | null;
  description: string;
  detectedCode: string | null;
}

export interface ParseResult {
  rows: ParsedStatementRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  transactionDate: ["data", "data contabile", "data operazione"],
  valueDate: ["valuta", "data valuta"],
  amount: ["importo", "importo (eur)", "importo eur", "importo (€)"],
  type: ["tipologia", "categoria"],
  description: ["descrizione", "causale", "descrizione operazione"],
};

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

// Le banche italiane esportano quasi sempre con ";" (la "," e' il separatore decimale),
// ma proviamo anche le alternative nel caso il file sia stato risalvato da un altro programma.
function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

function normalizeHeader(cell: string): string {
  return cell.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseItalianDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// "1.234,56" -> 1234.56, "-5,80" -> -5.8, "5.80" -> 5.8 (nessuna virgola: gia' in formato decimale).
function parseItalianAmount(raw: string): number | null {
  let s = raw.trim().replace(/[€\s]/g, "").replace(/EUR/gi, "");
  if (!s) return null;
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^[+-]/, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const value = parseFloat(s);
  if (Number.isNaN(value)) return null;
  return negative ? -Math.abs(value) : value;
}

// Codice terminale POS (es. "50000000000580-00000") o IBAN, per risalire al
// fornitore tramite supplier_account_codes: due movimenti con lo stesso codice
// sono la stessa cassa/beneficiario anche se il nome nella descrizione cambia leggermente.
export function extractDetectedCode(description: string): string | null {
  const iban = description.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/);
  if (iban) return iban[0];
  const pos = description.match(/\b\d{10,}-\d{4,6}\b/);
  if (pos) return pos[0];
  return null;
}

// Nome del commerciante/beneficiario, per suggerire un fornitore gia' noto quando
// il codice rilevato non e' ancora collegato a nessuno.
export function extractMerchantName(description: string): string | null {
  const pos = description.match(/DATA-ORA\s+\d{2}[-/]\d{2}[-/]\d{4}\s+[\d.:]+\s+(.+?)\s+\d{10,}-\d+/i);
  if (pos) return pos[1].trim();
  const bonifico = description.match(/(?:A FAVORE DI|BENEFICIARIO)\s*[:\-]?\s*(.+?)(?:\s+IBAN\b|\s+RIF\b|\s+CAUSALE\b|$)/i);
  if (bonifico) return bonifico[1].trim();
  return null;
}

export function parseBankStatementCsv(csvText: string): ParseResult {
  const errors: string[] = [];
  const lines = csvText.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);

  let headerIndex = -1;
  let delimiter = ";";
  let columnIndex: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const d = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], d).map(normalizeHeader);
    const hasDate = cells.some((c) => HEADER_ALIASES.transactionDate.includes(c));
    const hasAmount = cells.some((c) => HEADER_ALIASES.amount.includes(c));
    if (hasDate && hasAmount) {
      headerIndex = i;
      delimiter = d;
      const map: Record<string, number> = {};
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        const idx = cells.findIndex((c) => aliases.includes(c));
        if (idx >= 0) map[field] = idx;
      }
      columnIndex = map;
      break;
    }
  }

  if (headerIndex === -1) {
    return { rows: [], errors: ["Intestazione non riconosciuta: il file deve contenere almeno le colonne Data e Importo."] };
  }

  const rows: ParsedStatementRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (cells.every((c) => !c)) continue;

    const rawDate = columnIndex.transactionDate !== undefined ? cells[columnIndex.transactionDate] : undefined;
    const rawValue = columnIndex.valueDate !== undefined ? cells[columnIndex.valueDate] : undefined;
    const rawAmount = columnIndex.amount !== undefined ? cells[columnIndex.amount] : undefined;
    const rawType = columnIndex.type !== undefined ? cells[columnIndex.type] : undefined;
    const rawDescription = columnIndex.description !== undefined ? cells[columnIndex.description] : undefined;

    const transactionDate = rawDate ? parseItalianDate(rawDate) : null;
    const amount = rawAmount ? parseItalianAmount(rawAmount) : null;

    if (!transactionDate || amount === null) {
      errors.push(`Riga ${i + 1} ignorata: data o importo non leggibili ("${lines[i]}").`);
      continue;
    }

    const valueDate = (rawValue && parseItalianDate(rawValue)) || transactionDate;
    const description = (rawDescription || "").trim();

    rows.push({
      transactionDate,
      valueDate,
      amount,
      type: rawType?.trim() || null,
      description,
      detectedCode: extractDetectedCode(description),
    });
  }

  return { rows, errors };
}
