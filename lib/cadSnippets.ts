// Libreria di esempi pronti per l'editor CAD (cascade-core): raggruppati per
// categoria, mostrati nel pannello "Guida comandi" con pulsanti Copia/Inserisci.
export interface CadSnippet {
  name: string;
  description: string;
  code: string;
}

export interface CadSnippetCategory {
  title: string;
  snippets: CadSnippet[];
}

export const CAD_SNIPPET_CATEGORIES: CadSnippetCategory[] = [
  {
    title: "🧱 Forme base",
    snippets: [
      { name: "Cubo", description: "Box(x, y, z)", code: "Box(20, 20, 20);" },
      { name: "Sfera", description: "Sphere(raggio)", code: "Sphere(15);" },
      { name: "Cilindro", description: "Cylinder(raggio, altezza)", code: "Cylinder(10, 30);" },
      { name: "Cono", description: "Cone(raggio1, raggio2, altezza)", code: "Cone(15, 5, 25);" },
    ],
  },
  {
    title: "🔗 Unire e sottrarre",
    snippets: [
      {
        name: "Unione (due pezzi insieme)",
        description: "Union([forme])",
        code: `let base = Box(30, 30, 10);
let colonna = Translate([0, 0, 10], Cylinder(5, 20));
Union([base, colonna]);`,
      },
      {
        name: "Sottrazione (un foro)",
        description: "Difference(forma, [forme da togliere])",
        code: `let esterno = Cylinder(15, 30);
let foro = Cylinder(8, 40);
Difference(esterno, [foro]);`,
      },
      {
        name: "Intersezione (solo la parte in comune)",
        description: "Intersection([forme])",
        code: `let a = Box(20, 20, 20, true);
let b = Sphere(14);
Intersection([a, b]);`,
      },
    ],
  },
  {
    title: "↔️ Spostare, ruotare, specchiare",
    snippets: [
      {
        name: "Sposta e ruota",
        description: "Translate([x,y,z], forma) / Rotate([asse], gradi, forma)",
        code: `let forma = Box(10, 10, 10);
Rotate([0, 0, 1], 45, Translate([15, 0, 0], forma));`,
      },
      {
        name: "Specchia",
        description: "Mirror([asse], forma)",
        code: `let forma = Translate([10, 0, 0], Cone(8, 2, 15));
Union([forma, Mirror([1, 0, 0], forma, true)]);`,
      },
    ],
  },
  {
    title: "🪚 Spigoli",
    snippets: [
      {
        name: "Spigoli arrotondati",
        description: "FilletEdges(forma, raggio, indici spigoli)",
        code: `let box = Box(20, 20, 20);
FilletEdges(box, 3, Edges(box).max([0, 0, 1]).indices());`,
      },
      {
        name: "Spigoli smussati",
        description: "ChamferEdges(forma, distanza, indici spigoli)",
        code: `let box = Box(20, 20, 20);
ChamferEdges(box, 2, Edges(box).max([0, 0, 1]).indices());`,
      },
    ],
  },
  {
    title: "✏️ Disegno 2D → 3D",
    snippets: [
      {
        name: "Sagoma disegnata ed estrusa",
        description: "new Sketch([x,y]).LineTo(...).End(true).Face() poi Extrude",
        code: `let sagoma = new Sketch([0, 0])
  .LineTo([20, 0])
  .LineTo([20, 10])
  .LineTo([0, 10])
  .End(true);
Extrude(sagoma.Face(), [0, 0, 15]);`,
      },
    ],
  },
  {
    title: "🌀 Forme intrecciate e avanzate",
    snippets: [
      {
        name: "Anello (ciambella/torus)",
        description: "Un cerchio spostato dal centro, fatto ruotare attorno a un asse",
        code: `// R = raggio dell'anello, r = spessore del "tubo"
function anello(R, r) {
  return Revolve(Translate([R, 0, 0], Circle(r)), 360, [0, 0, 1]);
}

anello(20, 3);`,
      },
      {
        name: "Due anelli concatenati (catena)",
        description: "Due anelli su piani perpendicolari, agganciati come gli anelli di una catena",
        code: `function anello(R, r) {
  return Revolve(Translate([R, 0, 0], Circle(r)), 360, [0, 0, 1]);
}

let anello1 = anello(20, 3);
let anello2 = Translate([20, 0, 0], Rotate([0, 1, 0], 90, anello(20, 3)));

Union([anello1, anello2]);
// Se non sembrano agganciati, prova a cambiare il raggio R (20) o lo spostamento [20,0,0].`,
      },
      {
        name: "Molla / elica",
        description: "Un profilo circolare (il \"filo\") che segue un percorso a spirale",
        code: `let punti = [];
for (let i = 0; i <= 60; i++) {
  let angolo = i * 24; // gradi per passo (60 passi * 24° = 4 giri completi)
  let raggio = 15;
  let altezzaPerGiro = 8;
  let x = raggio * Math.cos(angolo * Math.PI / 180);
  let y = raggio * Math.sin(angolo * Math.PI / 180);
  let z = (angolo / 360) * altezzaPerGiro;
  punti.push([x, y, z]);
}
let percorso = BSpline(punti);
let filo = Circle(1.5);
Pipe(filo, percorso);`,
      },
      {
        name: "Colonna attorcigliata (treccia)",
        description: "Una sagoma a stella estrusa in verticale con una torsione",
        code: `let stella = new Sketch([10, 0])
  .LineTo([3, 3]).LineTo([0, 10]).LineTo([-3, 3]).LineTo([-10, 0])
  .LineTo([-3, -3]).LineTo([0, -10]).LineTo([3, -3])
  .End(true);
RotatedExtrude(stella.Wire(), 40, 180); // 40 = altezza, 180 = gradi di torsione`,
      },
    ],
  },
];
