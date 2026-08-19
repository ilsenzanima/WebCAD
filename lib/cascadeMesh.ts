import * as THREE from "three";
import type { CascadeMeshData } from "@/lib/types/database";

// Unisce tutte le facce restituite da cascade-core (ognuna gia' triangolata,
// con propri indici locali) in un'unica BufferGeometry three.js, sommando un
// offset agli indici di ciascuna faccia via via che vengono accodate.
export function buildGeometryFromMeshData(meshData: CascadeMeshData): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const face of meshData.faces || []) {
    positions.push(...face.vertex_coord);
    normals.push(...face.normal_coord);
    for (const idx of face.tri_indexes) indices.push(idx + vertexOffset);
    vertexOffset += face.vertex_coord.length / 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

// Le linee degli spigoli (silhouette), rese come LineSegments separati dalla mesh piena.
export function buildEdgeLinesFromMeshData(meshData: CascadeMeshData): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const edge of meshData.edges || []) {
    const coords = edge.vertex_coord;
    for (let i = 0; i + 5 < coords.length + 3; i += 3) {
      if (i + 3 >= coords.length) break;
      positions.push(coords[i], coords[i + 1], coords[i + 2], coords[i + 3], coords[i + 4], coords[i + 5]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
