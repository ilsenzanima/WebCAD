"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CascadeMeshData } from "@/lib/types/database";
import { buildGeometryFromMeshData, buildEdgeLinesFromMeshData } from "@/lib/cascadeMesh";

interface ModelViewer3DProps {
  meshData: CascadeMeshData | null;
}

export interface ModelViewer3DHandle {
  captureThumbnail: () => string | null;
}

// Scena three.js minimale (luci, griglia, orbit controls) che mostra la mesh
// restituita da cascade-core. Non interattiva sul disegno del modello:
// serve solo a visualizzarlo e a catturarne un'anteprima PNG.
function ModelViewer3D({ meshData }: ModelViewer3DProps, ref: React.Ref<ModelViewer3DHandle>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  useImperativeHandle(ref, () => ({
    captureThumbnail: () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18181b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 10000);
    camera.position.set(80, 80, 80);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(120, 200, 150);
    scene.add(dirLight);
    scene.add(new THREE.GridHelper(200, 20, 0x3f3f46, 0x27272a));

    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current);
      meshGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      meshGroupRef.current = null;
    }

    if (!meshData) return;

    const group = new THREE.Group();
    const geometry = buildGeometryFromMeshData(meshData);
    const material = new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(geometry, material));

    const edgeGeometry = buildEdgeLinesFromMeshData(meshData);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x18181b });
    group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    scene.add(group);
    meshGroupRef.current = group;
  }, [meshData]);

  return <div ref={containerRef} className="w-full h-full min-h-[300px]" />;
}

export default forwardRef(ModelViewer3D);
