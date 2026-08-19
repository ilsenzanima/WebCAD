import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // cascade-core (motore CAD 3D) trascina openscad-parser, che usa "fs"/"os"
      // (solo per la sintassi OpenSCAD, non usata da quest'app): fuori dal bundle browser.
      "openscad-parser": { browser: "./lib/stubs/openscad-parser-stub.js" },
    },
  },
};

export default nextConfig;
