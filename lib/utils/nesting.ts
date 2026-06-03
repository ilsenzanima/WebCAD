/**
 * WebCAD — Algoritmo Nesting 2D (MaxRects / FFD)
 * Port TypeScript dell'algoritmo originale in nesting-algo.js
 */

export const PIECE_COLORS: string[] = [
  '#60a5fa', // blu
  '#34d399', // smeraldo
  '#c084fc', // viola
  '#f472b6', // rosa
  '#fbbf24', // ambra
  '#2dd4bf', // teal
  '#818cf8', // indigo
  '#fb923c', // arancio
  '#86efac', // verde chiaro
  '#e879f9', // fucsia
  '#38bdf8', // azzurro
  '#facc15', // giallo
  '#f87171', // rosso chiaro
  '#4ade80', // lime
  '#a3e635', // giallo-verde
];

export interface NestingPiece {
  id: string;
  b: number;
  h: number;
  q: number;
  unit: 'cm' | 'mm';
  refTitle: string;
}

export interface NestingParams {
  sheetW: number;
  sheetH: number;
  kerf?: number;
  margin?: number;
}

export interface PlacedPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  label: string;
  dims: string;
  pieceIndex: number;
}

export interface PackedSheet {
  placed: PlacedPiece[];
  usedArea: number;
}

export interface NestingResult {
  sheets: PackedSheet[];
  totalPieces: number;
  efficiency: number;
  waste: number;
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface NestingRequest {
  width: number;
  height: number;
  pieceIndex: number;
  label: string;
  dims: string;
}

interface BestPlacement {
  s: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export function runNesting(pieces: NestingPiece[], params: NestingParams): NestingResult {
  const { sheetW, sheetH, kerf = 3, margin = 0 } = params;

  // Espandi i pezzi in richieste individuali
  const requests: NestingRequest[] = [];
  pieces.forEach((p, pieceIndex) => {
    const factor = p.unit === 'cm' ? 10 : 1;
    const wMm = Math.round(p.b * factor);
    const hMm = Math.round(p.h * factor);
    if (wMm > 0 && hMm > 0 && p.q > 0) {
      for (let i = 0; i < p.q; i++) {
        requests.push({
          width: wMm,
          height: hMm,
          pieceIndex,
          label: p.refTitle,
          dims: `${p.b}×${p.h} ${p.unit}`,
        });
      }
    }
  });

  const totalPieces = requests.length;
  const activeW = sheetW - margin * 2;
  const activeH = sheetH - margin * 2;

  if (totalPieces === 0 || activeW <= 0 || activeH <= 0) {
    return { sheets: [], totalPieces: 0, efficiency: 0, waste: 0 };
  }

  // Ordina per area decrescente (FFD)
  const sorted = [...requests].sort((a, b) => b.width * b.height - a.width * a.height);

  const sheets: PackedSheet[] = [];
  const free: FreeRect[][] = [];

  const newSheet = (): number => {
    const i = sheets.length;
    sheets.push({ placed: [], usedArea: 0 });
    free.push([{ x: margin, y: margin, w: activeW, h: activeH }]);
    return i;
  };

  const contains = (a: FreeRect, b: FreeRect): boolean =>
    b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

  const prune = (si: number): void => {
    const r = free[si];
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        if (contains(r[i], r[j])) r.splice(j--, 1);
        else if (contains(r[j], r[i])) { r.splice(i--, 1); break; }
      }
    }
  };

  const splitRect = (f: FreeRect, p: { x: number; y: number; w: number; h: number }): FreeRect[] => {
    const pw = p.w + kerf;
    const ph = p.h + kerf;
    if (p.x >= f.x + f.w || p.x + pw <= f.x || p.y >= f.y + f.h || p.y + ph <= f.y) return [f];
    const res: FreeRect[] = [];
    if (p.y > f.y)           res.push({ x: f.x, y: f.y,       w: f.w, h: p.y - f.y });
    if (p.y + ph < f.y + f.h) res.push({ x: f.x, y: p.y + ph, w: f.w, h: f.y + f.h - (p.y + ph) });
    if (p.x > f.x)           res.push({ x: f.x, y: f.y,       w: p.x - f.x, h: f.h });
    if (p.x + pw < f.x + f.w) res.push({ x: p.x + pw, y: f.y, w: f.x + f.w - (p.x + pw), h: f.h });
    return res;
  };

  sorted.forEach((req) => {
    let best: BestPlacement | null = null;

    const tryPlace = (s: number, fr: FreeRect, w: number, h: number, rotated: boolean): void => {
      if (w > fr.w || h > fr.h) return;
      const c: BestPlacement = { s, x: fr.x, y: fr.y, w, h, rotated };
      if (
        !best ||
        s < best.s ||
        (s === best.s && fr.y < best.y) ||
        (s === best.s && fr.y === best.y && fr.x < best.x)
      ) {
        best = c;
      }
    };

    for (let s = 0; s < sheets.length; s++) {
      for (const fr of free[s]) {
        tryPlace(s, fr, req.width, req.height, false);
        if (req.width !== req.height) tryPlace(s, fr, req.height, req.width, true);
      }
    }

    if (!best) {
      const s = newSheet();
      const fr = free[s][0];
      if (req.width <= fr.w && req.height <= fr.h) {
        best = { s, x: fr.x, y: fr.y, w: req.width, h: req.height, rotated: false };
      } else if (req.height <= fr.w && req.width <= fr.h) {
        best = { s, x: fr.x, y: fr.y, w: req.height, h: req.width, rotated: true };
      } else {
        return; // pezzo troppo grande, salta
      }
    }

    const { s, x, y, w, h, rotated } = best;
    sheets[s].placed.push({ x, y, w, h, rotated, label: req.label, dims: req.dims, pieceIndex: req.pieceIndex });
    sheets[s].usedArea += w * h;

    const newFree: FreeRect[] = [];
    free[s].forEach((fr) => newFree.push(...splitRect(fr, { x, y, w, h })));
    free[s] = newFree;
    prune(s);
  });

  const boardArea = sheetW * sheetH;
  const totalUsed = sheets.reduce((a, s) => a + s.usedArea, 0);
  const eff = sheets.length ? (totalUsed / (sheets.length * boardArea)) * 100 : 0;

  return {
    sheets,
    totalPieces,
    efficiency: Math.round(eff * 10) / 10,
    waste: Math.round((100 - eff) * 10) / 10,
  };
}
