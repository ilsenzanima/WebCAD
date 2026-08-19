import type { SketchStroke } from "@/lib/types/database";

// Foglio logico su cui si disegna: risoluzione fissa indipendente dalla
// larghezza visualizzata (editor a tutta pagina o miniatura in vetrina),
// cosi' il tratto resta coerente ovunque venga renderizzato.
export const SHEET_WIDTH = 1400;
export const SHEET_HEIGHT = 900;

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: SketchStroke) {
  if (stroke.points.length === 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;

  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    ctx.globalAlpha = 0.5 + p.pressure * 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (stroke.size * (0.35 + p.pressure * 1.3)) / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  for (let i = 1; i < stroke.points.length; i++) {
    const prev = stroke.points[i - 1];
    const curr = stroke.points[i];
    ctx.globalAlpha = 0.5 + curr.pressure * 0.5;
    ctx.lineWidth = stroke.size * (0.35 + curr.pressure * 1.3);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Ridisegna da zero un foglio (bianco + tutti i tratti), in coordinate logiche SHEET_WIDTH x SHEET_HEIGHT.
export function renderSketch(ctx: CanvasRenderingContext2D, strokes: SketchStroke[]) {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  for (const stroke of strokes) drawStroke(ctx, stroke);
}
