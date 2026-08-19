// Copia il worker/WASM di cascade-core (motore CAD 3D) da node_modules a
// public/cad/, dove il browser puo' caricarli come file statici. Va rifatto
// ad ogni "npm install" (versione del pacchetto puo' cambiare), percio' e'
// uno script "postinstall" invece di file committati nel repo.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "cascade-core", "dist");
const dest = path.join(__dirname, "..", "public", "cad");

if (!fs.existsSync(src)) {
  console.warn("[copy-cascade-assets] cascade-core non trovato in node_modules, salto la copia.");
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`[copy-cascade-assets] Asset CAD copiati in ${dest}`);
