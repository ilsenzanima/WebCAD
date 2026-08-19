// Stub per "openscad-parser" nel bundle browser: e' una dipendenza di
// cascade-core (via OpenSCADTranspiler) che usa moduli Node ("fs", "os")
// incompatibili col browser. L'app non usa la sintassi OpenSCAD, solo il
// motore CAD (CascadeEngine), percio' questo stub evita di trascinare
// "fs"/"os" nel bundle client senza dover forkare cascade-core.
export default {};
