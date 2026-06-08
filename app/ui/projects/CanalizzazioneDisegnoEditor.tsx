"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";
import type { FieldNote, FieldNoteItem, FieldNoteType } from "@/app/actions/field-notes";
import type { Material } from "@/lib/types/database";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

interface Segment {
  id: string;
  nome: string;
  lunghezza: number; // in cm
  svolta: "Nessuna" | "Destra" | "Sinistra" | "Alto" | "Basso";
}

interface Props {
  projectId: string;
  noteTypes: FieldNoteType[];
  initialNote: FieldNote;
  catalogMaterials: Material[];
}

// Componente 3D per l'Elbow (Curva 90 gradi)
function ElbowMesh({ type, w_outer, h_outer, isSelected, onClick }: any) {
  let size: [number, number, number] = [w_outer, h_outer, w_outer];
  if (type === "Alto" || type === "Basso") {
    size = [w_outer, h_outer, h_outer];
  }

  return (
    <mesh position={[0, 0, 0]} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={isSelected ? "hsl(220, 90%, 56%)" : "#cbd5e1"}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

// Scena 3D interna
function RouteScene({ calculatedPath, w, h, t, selectedSegmentId, setSelectedSegmentId }: any) {
  const w_outer = w + 2 * t;
  const h_outer = h + 2 * t;

  return (
    <group>
      {calculatedPath.map((elem: any, idx: number) => {
        const isSelected = selectedSegmentId === elem.segmentId;

        if (elem.type === "straight") {
          return (
            <group
              key={`straight-${elem.segmentId}-${idx}`}
              position={[elem.center.x, elem.center.y, elem.center.z]}
              quaternion={elem.quaternion}
            >
              {/* Lastra Inferiore (Base) */}
              <mesh
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSegmentId(elem.segmentId);
                }}
              >
                <boxGeometry args={[w_outer, t, elem.length]} />
                <meshStandardMaterial
                  color={isSelected ? "hsl(220, 90%, 56%)" : "#e2e8f0"}
                  roughness={0.8}
                />
              </mesh>

              {/* Lastra Superiore (Coperchio) */}
              <mesh
                position={[0, h + t, 0]}
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSegmentId(elem.segmentId);
                }}
              >
                <boxGeometry args={[w_outer, t, elem.length]} />
                <meshStandardMaterial
                  color={isSelected ? "hsl(220, 90%, 56%)" : "#e2e8f0"}
                  roughness={0.8}
                />
              </mesh>

              {/* Lastra Fianco Sinistro */}
              <mesh
                position={[-w / 2 - t / 2, h / 2 + t / 2, 0]}
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSegmentId(elem.segmentId);
                }}
              >
                <boxGeometry args={[t, h, elem.length]} />
                <meshStandardMaterial
                  color={isSelected ? "hsl(220, 90%, 56%)" : "#e2e8f0"}
                  roughness={0.8}
                />
              </mesh>

              {/* Lastra Fianco Destro */}
              <mesh
                position={[w / 2 + t / 2, h / 2 + t / 2, 0]}
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSegmentId(elem.segmentId);
                }}
              >
                <boxGeometry args={[t, h, elem.length]} />
                <meshStandardMaterial
                  color={isSelected ? "hsl(220, 90%, 56%)" : "#e2e8f0"}
                  roughness={0.8}
                />
              </mesh>

              {/* Staffe / Barre di supporto e pendini sotto la canalizzazione */}
              {elem.length > 0.6 && (
                <group>
                  {(elem.length <= 1.8 ? [0] : [-elem.length / 2 + 0.4, elem.length / 2 - 0.4]).map((zPos, idx) => (
                    <group key={`support-${idx}`} position={[0, 0, zPos]}>
                      {/* Barra asolata di supporto sotto il canale */}
                      <mesh position={[0, -t / 2 - 0.02, 0]} castShadow receiveShadow>
                        <boxGeometry args={[w_outer + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.8} />
                      </mesh>
                      {/* Pendini verticali di sospensione a soffitto */}
                      <mesh position={[-w_outer / 2 - 0.06, 1.0, 0]} castShadow>
                        <cylinderGeometry args={[0.008, 0.008, 2.0]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.1} metalness={0.9} />
                      </mesh>
                      <mesh position={[w_outer / 2 + 0.06, 1.0, 0]} castShadow>
                        <cylinderGeometry args={[0.008, 0.008, 2.0]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.1} metalness={0.9} />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}

              {/* Coprigiunti in lastra di Silicato (passo 120cm) se previsti */}
              {elem.length > 0.1 && (
                <group>
                  {/* Coprigiunto inizio */}
                  <mesh position={[0, h / 2 + t / 2, -elem.length / 2 + 0.075]} castShadow receiveShadow>
                    <boxGeometry args={[w_outer + 2 * t, h_outer + 2 * t, 0.15]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.8} transparent opacity={0.85} />
                  </mesh>
                  {/* Coprigiunto fine */}
                  <mesh position={[0, h / 2 + t / 2, elem.length / 2 - 0.075]} castShadow receiveShadow>
                    <boxGeometry args={[w_outer + 2 * t, h_outer + 2 * t, 0.15]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.8} transparent opacity={0.85} />
                  </mesh>
                  {/* Coprigiunti intermedi ogni 1.2 m */}
                  {Array.from({ length: Math.floor(elem.length / 1.2) }).map((_, kIdx) => {
                    const zPos = -elem.length / 2 + 1.2 * (kIdx + 1);
                    if (zPos < elem.length / 2 - 0.1) {
                      return (
                        <mesh key={`collar-${kIdx}`} position={[0, h / 2 + t / 2, zPos]} castShadow receiveShadow>
                          <boxGeometry args={[w_outer + 2 * t, h_outer + 2 * t, 0.15]} />
                          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
                        </mesh>
                      );
                    }
                    return null;
                  })}
                </group>
              )}
            </group>
          );
        } else if (elem.type === "elbow") {
          return (
            <group
              key={`elbow-${elem.segmentId}-${idx}`}
              position={[elem.center.x, elem.center.y, elem.center.z]}
              quaternion={elem.quaternion}
            >
              <ElbowMesh
                type={elem.svolta}
                w_outer={elem.w_outer}
                h_outer={elem.h_outer}
                sizeD={elem.sizeD}
                isSelected={isSelected}
                onClick={() => setSelectedSegmentId(elem.segmentId)}
              />
            </group>
          );
        }
        return null;
      })}
    </group>
  );
}

export default function CanalizzazioneDisegnoEditor({
  projectId,
  noteTypes,
  initialNote,
  catalogMaterials,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isDataActual, setIsDataActual] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tempIdMap = useOfflineStore((state) => state.tempIdMap);
  const resolvedNoteId = initialNote?.id ? (tempIdMap[initialNote.id] ?? initialNote.id) : "";
  const cachedNote = useOfflineStore((state) => state.fieldNotes[resolvedNoteId]);
  const noteToUse = (mounted && cachedNote) ? cachedNote : initialNote;

  // --- Stati di Configurazione ---
  const [title, setTitle] = useState("Nuovo Tracciato");
  const [foroW, setForoW] = useState(40); // cm
  const [foroH, setForoH] = useState(30); // cm
  const [materialId, setMaterialId] = useState("");
  const [conGiunti, setConGiunti] = useState(true);
  const [segments, setSegments] = useState<Segment[]>([
    { id: "s-1", nome: "Tratto Iniziale", lunghezza: 120, svolta: "Nessuna" }
  ]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Imposta il materiale di default se vuoto
  useEffect(() => {
    if (catalogMaterials.length > 0 && !materialId) {
      setMaterialId(catalogMaterials[0].id);
    }
  }, [catalogMaterials, materialId]);

  // Caricamento dei dati salvati
  useEffect(() => {
    if (mounted) {
      const hasCachedData = !!cachedNote;
      if (!initialized || (hasCachedData && !isDataActual)) {
        const noteSource = cachedNote || initialNote;
        if (noteSource) {
          // Titolo
          const titleItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "nota" && i.sort_order === 0
          );
          if (titleItem?.value_text) {
            setTitle(titleItem.value_text.replace("Disegno: ", ""));
          }

          // Parametri Generali
          const configItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "nota" && i.sort_order === 3
          );
          if (configItem?.value_text) {
            try {
              const cfg = JSON.parse(configItem.value_text);
              if (cfg.foroW !== undefined) setForoW(cfg.foroW);
              if (cfg.foroH !== undefined) setForoH(cfg.foroH);
              if (cfg.conGiunti !== undefined) setConGiunti(cfg.conGiunti);
              if (cfg.materialId !== undefined) setMaterialId(cfg.materialId);
            } catch {}
          }

          // Segmenti
          const segmentsItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "dim_quadrata" && i.sort_order === 1
          );
          if (segmentsItem?.value_text) {
            try {
              const parsedSegs = JSON.parse(segmentsItem.value_text);
              if (Array.isArray(parsedSegs)) {
                setSegments(parsedSegs);
              }
            } catch {}
          }

          setInitialized(true);
          setIsDataActual(hasCachedData);
        }
      }
    }
  }, [mounted, cachedNote, initialNote, initialized, isDataActual, catalogMaterials]);

  // Trova spessore materiale
  const selectedMaterial = useMemo(() => {
    return catalogMaterials.find((m) => m.id === materialId) || catalogMaterials[0];
  }, [catalogMaterials, materialId]);

  const thicknessMm = useMemo(() => {
    return selectedMaterial?.thickness_mm || 50; // Spessore di default 50 mm
  }, [selectedMaterial]);

  // Gestori del tracciato
  const handleAddSegment = () => {
    const newSeg: Segment = {
      id: generateTempId(),
      nome: `Tratto ${segments.length + 1}`,
      lunghezza: 100,
      svolta: "Nessuna",
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  const handleUpdateSegment = (id: string, key: keyof Segment, value: any) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
  };

  const handleDeleteSegment = (id: string) => {
    if (segments.length <= 1) {
      alert("Il tracciato deve contenere almeno un segmento!");
      return;
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
    if (selectedSegmentId === id) setSelectedSegmentId(null);
  };

  const handleMoveSegment = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === segments.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newSegments = [...segments];
    const temp = newSegments[index];
    newSegments[index] = newSegments[targetIndex];
    newSegments[targetIndex] = temp;
    setSegments(newSegments);
  };

  // Calcolo geometrico procedurale del tracciato 3D
  const calculatedPath = useMemo(() => {
    const renderedElements: any[] = [];

    let currentPos = new THREE.Vector3(0, 0, 0);
    let currentDir = new THREE.Vector3(0, 0, 1); // Direzione +Z iniziale
    let currentUp = new THREE.Vector3(0, 1, 0); // Up iniziale
    let currentRight = new THREE.Vector3(1, 0, 0); // Right iniziale

    const w = foroW * 0.01;
    const h = foroH * 0.01;
    const t = thicknessMm * 0.001;

    const w_outer = w + 2 * t;
    const h_outer = h + 2 * t;

    segments.forEach((seg, index) => {
      const L = seg.lunghezza * 0.01; // lunghezza in metri

      const startPoint = currentPos.clone();
      const endPoint = currentPos.clone().addScaledVector(currentDir, L);
      const centerPoint = currentPos.clone().addScaledVector(currentDir, L / 2);

      const basisMatrix = new THREE.Matrix4();
      basisMatrix.makeBasis(currentRight, currentUp, currentDir);
      const rotation = new THREE.Quaternion().setFromRotationMatrix(basisMatrix);

      renderedElements.push({
        type: "straight",
        segmentId: seg.id,
        name: seg.nome,
        start: startPoint,
        end: endPoint,
        center: centerPoint,
        length: L,
        quaternion: rotation,
      });

      currentPos = endPoint.clone();

      if (seg.svolta !== "Nessuna") {
        let D = w_outer;
        if (seg.svolta === "Alto" || seg.svolta === "Basso") {
          D = h_outer;
        }

        let nextDir = currentDir.clone();
        let nextUp = currentUp.clone();
        let nextRight = currentRight.clone();

        if (seg.svolta === "Destra") {
          nextDir.copy(currentRight);
          nextRight.copy(currentDir).multiplyScalar(-1);
        } else if (seg.svolta === "Sinistra") {
          nextDir.copy(currentRight).multiplyScalar(-1);
          nextRight.copy(currentDir);
        } else if (seg.svolta === "Alto") {
          nextDir.copy(currentUp);
          nextUp.copy(currentDir).multiplyScalar(-1);
        } else if (seg.svolta === "Basso") {
          nextDir.copy(currentUp).multiplyScalar(-1);
          nextUp.copy(currentDir);
        }

        const posTurn = currentPos.clone().addScaledVector(currentDir, D / 2);
        const posNextStart = posTurn.clone().addScaledVector(nextDir, D / 2);
        const posElbow = currentPos.clone().addScaledVector(currentDir, D / 2).addScaledVector(nextDir, D / 2);

        const elbowBasis = new THREE.Matrix4();
        elbowBasis.makeBasis(currentRight, currentUp, currentDir);
        const elbowRotation = new THREE.Quaternion().setFromRotationMatrix(elbowBasis);

        renderedElements.push({
          type: "elbow",
          segmentId: seg.id,
          svolta: seg.svolta,
          center: posTurn,
          quaternion: elbowRotation,
          sizeD: D,
          w_outer,
          h_outer,
        });

        currentPos = posNextStart.clone();
        currentDir.copy(nextDir);
        currentUp.copy(nextUp);
        currentRight.copy(nextRight);
      }
    });

    return renderedElements;
  }, [segments, foroW, foroH, thicknessMm]);

  // Calcolo del Centro del Tracciato per camera target
  const routeCenter = useMemo(() => {
    if (calculatedPath.length === 0) return new THREE.Vector3(0, 0, 0);
    const center = new THREE.Vector3(0, 0, 0);
    let count = 0;
    calculatedPath.forEach((elem) => {
      center.add(elem.center);
      count++;
    });
    return center.divideScalar(count || 1);
  }, [calculatedPath]);

  // Reset Camera
  const controlsRef = useRef<any>(null);
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(routeCenter.x, routeCenter.y, routeCenter.z);
      const camera = controlsRef.current.object;
      camera.position.set(routeCenter.x + 3, routeCenter.y + 3, routeCenter.z + 4);
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    if (mounted && controlsRef.current) {
      controlsRef.current.target.set(routeCenter.x, routeCenter.y, routeCenter.z);
      controlsRef.current.update();
    }
  }, [mounted, routeCenter]);

  // --- Calcoli del Computo Metrico (Sintesi) ---
  const computations = useMemo(() => {
    const totalLengthCm = segments.reduce((sum, s) => sum + s.lunghezza, 0);
    const totalLengthM = totalLengthCm / 100;

    let totalPlatesAreaM2 = 0;
    let totalElbows = 0;
    let totalScrews = 0;
    let totalJoints = 0;

    const tCm = thicknessMm / 10;
    const wOuterCm = foroW + 2 * tCm;
    const hOuterCm = foroH + 2 * tCm;

    // Lastre e Viti per tratti dritti
    segments.forEach((seg) => {
      const L = seg.lunghezza;
      const perimeterCm = 2 * wOuterCm + 2 * foroH;
      const areaCm2 = perimeterCm * L;
      totalPlatesAreaM2 += areaCm2 / 10000;

      // Viti: stima a passo 15 cm lungo i 4 spigoli
      totalScrews += 4 * Math.ceil(L / 15);

      // Giunti intermedi del tratto dritto
      if (conGiunti) {
        totalJoints += Math.floor(L / 120);
      }
    });

    // Pezzi speciali Curve ed Elbows
    segments.forEach((seg) => {
      if (seg.svolta !== "Nessuna") {
        totalElbows++;
        if (conGiunti) {
          totalJoints += 2; // Giunti in ingresso ed uscita per l'elbow
        }
        totalScrews += 24; // Viti stimate per il montaggio dell'elbow

        // Superficie lastre per gomiti a 90°
        if (seg.svolta === "Destra" || seg.svolta === "Sinistra") {
          const areaCm2 = 2 * (wOuterCm * wOuterCm) + (wOuterCm + 2 * tCm) * foroH;
          totalPlatesAreaM2 += areaCm2 / 10000;
        } else {
          const areaCm2 = 2 * (hOuterCm * hOuterCm) + (hOuterCm + 2 * tCm) * foroW;
          totalPlatesAreaM2 += areaCm2 / 10000;
        }
      }
    });

    const sheetLengthM = selectedMaterial?.length_mm ? selectedMaterial.length_mm / 1000 : 2.0;
    const sheetWidthM = selectedMaterial?.width_mm ? selectedMaterial.width_mm / 1000 : 1.2;
    const sheetArea = sheetLengthM * sheetWidthM;
    const totalSheets = Math.ceil(totalPlatesAreaM2 / sheetArea);

    const perimeterM = (2 * foroW + 2 * foroH) / 100;
    const totalProfileM = totalJoints * perimeterM;

    return {
      totalLengthM,
      totalElbows,
      totalPlatesAreaM2,
      totalSheets,
      totalScrews,
      totalJoints,
      totalProfileM,
    };
  }, [segments, foroW, foroH, thicknessMm, conGiunti, selectedMaterial]);

  const handleDeleteDrawing = () => {
    if (confirm("Sei sicuro di voler eliminare questo disegno?")) {
      useOfflineStore.getState().deleteFieldNoteOptimistic(resolvedNoteId, projectId);
      router.push(`/projects/${projectId}`);
    }
  };

  // --- Salvataggio ---
  const handleSave = () => {
    setSaveStatus("saving");
    const matchedType = noteTypes.find((t) => t.name === "Disegno") || { id: "temp_disegno", name: "Disegno" };
    const matName = selectedMaterial?.name || "Generico";

    const payloadItems: Omit<FieldNoteItem, "id">[] = [
      {
        item_type: "nota",
        value_text: `Disegno: ${title.trim() || "Nuovo Tracciato"}`,
        sort_order: 0,
      },
      {
        item_type: "dim_quadrata",
        value_text: JSON.stringify(segments),
        sort_order: 1,
      },
      {
        item_type: "materiale",
        value_text: matName,
        sort_order: 2,
      },
      {
        item_type: "nota",
        value_text: JSON.stringify({ foroW, foroH, conGiunti, materialId }),
        sort_order: 3,
      },
    ];

    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      resolvedNoteId,
      projectId,
      noteToUse.level_id || null,
      payloadItems,
      "Disegno"
    );

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  // --- Esporta PDF con Screenshot 3D ---
  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      handleSave();

      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      // Cattura immagine del canvas 3D
      const canvasElement = document.querySelector("canvas");
      const canvasImage = canvasElement ? canvasElement.toDataURL("image/jpeg", 0.8) : null;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Crea un container HTML temporaneo per pagina 1
      const page1Div = document.createElement("div");
      page1Div.style.position = "fixed";
      page1Div.style.left = "0";
      page1Div.style.top = "0";
      page1Div.style.width = "750px";
      page1Div.style.background = "#ffffff";
      page1Div.style.color = "#000000";
      page1Div.style.padding = "35px";
      page1Div.style.zIndex = "-9999";
      page1Div.style.pointerEvents = "none";
      page1Div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

      const segmentsRowsHtml = segments
        .map(
          (seg, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${seg.nome}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${seg.lunghezza} cm</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${
            seg.svolta !== "Nessuna" ? "#b45309" : "#475569"
          }">${seg.svolta}</td>
        </tr>
      `
        )
        .join("");

      page1Div.innerHTML = `
        <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 22px; font-weight: 800; text-transform: uppercase;">📐 Disegno Tecnico e Routing Canalizzazioni</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #4b5563;">
            <span><strong>Cantiere:</strong> ID ${projectId}</span>
            <span><strong>Data:</strong> ${new Date().toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;">
          <h2 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; font-weight: 700;">📋 Parametri della Canalizzazione</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #334155;">
            <div><strong>Titolo Tracciato:</strong> ${title}</div>
            <div><strong>Materiale Lastre:</strong> ${selectedMaterial?.name || "Generico"} (${thicknessMm} mm)</div>
            <div><strong>Dimensioni Foro Interno:</strong> ${foroW} x ${foroH} cm</div>
            <div><strong>Coprigiunti in Silicato:</strong> ${conGiunti ? "Attivi (Passo 120cm)" : "Non Attivi"}</div>
          </div>
        </div>

        <div style="margin-bottom: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 15px;">
          <h2 style="margin: 0 0 10px 0; font-size: 13px; color: #166534; font-weight: 700;">📊 Computo Metrico e Distinta Materiali</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #14532d;">
            <div><strong>Lunghezza Totale Tracciato:</strong> ${computations.totalLengthM.toFixed(2)} m</div>
            <div><strong>Numero di Curve (Gomiti 90°):</strong> ${computations.totalElbows} pezzi</div>
            <div><strong>Superficie Totale Lastre:</strong> ${computations.totalPlatesAreaM2.toFixed(2)} m²</div>
            <div><strong>Lastre da Ordinare (Fogli):</strong> ~${computations.totalSheets} pezzi</div>
            <div><strong>Numero di Viti Stimato:</strong> ~${computations.totalScrews} pezzi</div>
            <div><strong>Coprigiunti in Silicato:</strong> ${computations.totalProfileM.toFixed(2)} m</div>
          </div>
        </div>

        <div>
          <h2 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">🛤️ Sequenza dei Segmenti</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-weight: bold; color: #475569;">
                <th style="padding: 8px; border: 1px solid #e2e8f0; width: 40px;">#</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0;">Nome Segmento</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0; width: 120px;">Lunghezza (cm)</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0; width: 150px;">Svolta Successiva</th>
              </tr>
            </thead>
            <tbody>
              ${segmentsRowsHtml}
            </tbody>
          </table>
        </div>
      `;

      document.body.appendChild(page1Div);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas1 = await html2canvas(page1Div, {
        scale: 1.3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData1 = canvas1.toDataURL("image/jpeg", 0.85);
      document.body.removeChild(page1Div);

      const heightInPdf1 = (canvas1.height * (pdfWidth - 20)) / canvas1.width;
      pdf.addImage(imgData1, "JPEG", 10, 10, pdfWidth - 20, heightInPdf1);

      // Inserisce il rendering 3D in seconda pagina se presente
      if (canvasImage) {
        pdf.addPage();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(30, 58, 138); // #1e3a8a
        pdf.text("📐 RENDERING 3D DEL TRACCIATO PARAMETRICO", 10, 20);

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.line(10, 24, pdfWidth - 10, 24);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(75, 85, 99);
        pdf.text("La visualizzazione 3D mostra la sequenza di canali dritti ed elbows assemblati in scala.", 10, 30);

        pdf.addImage(canvasImage, "JPEG", 10, 35, pdfWidth - 20, 115);

        // Footer in seconda pagina
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Esportato tramite WebCAD Antincendio - Pagina 2 di 2`, 10, pdfHeight - 10);
      }

      pdf.save(`WebCAD_Disegno_${title.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Errore durante la generazione del PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white/50 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-sm">Caricamento dello Spazio di Lavoro...</p>
      </div>
    );
  }

  const w3d = foroW * 0.01;
  const h3d = foroH * 0.01;
  const t3d = thicknessMm * 0.001;

  return (
    <div className="space-y-6">
      {/* ── Barra Azioni Superiore ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Torna al Cantiere"
          >
            ←
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-primary text-lg font-bold text-white outline-none py-0.5 px-1 w-full max-w-[280px] sm:max-w-md transition-colors"
            placeholder="Nome Tracciato"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isGeneratingPDF}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            {isGeneratingPDF ? "Generazione..." : "📥 Esporta PDF"}
          </button>
          <button
            type="button"
            onClick={handleDeleteDrawing}
            className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all active:scale-95 cursor-pointer"
          >
            Elimina
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all bg-brand hover:bg-brand/90 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            style={{ background: "hsl(220, 90%, 56%)" }}
          >
            {saveStatus === "saving" ? "Salvataggio..." : saveStatus === "saved" ? "Salvato! ✓" : "Salva"}
          </button>
        </div>
      </div>

      {/* ── Area Principale Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Parametri e Griglia Segmenti (Colonna SX) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Parametri Foro e Materiale */}
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Parametri Geometrici
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Foro Larghezza W (cm)</label>
                <input
                  type="number"
                  value={foroW}
                  onChange={(e) => setForoW(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-sm text-white focus:border-brand outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Foro Altezza H (cm)</label>
                <input
                  type="number"
                  value={foroH}
                  onChange={(e) => setForoH(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-sm text-white focus:border-brand outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50 block">Materiale Silicato (Spessore)</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-sm text-white focus:border-brand outline-none cursor-pointer"
              >
                {catalogMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name} ({mat.thickness_mm ?? 50} mm)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-white/70">Coprigiunti in Silicato (Passo 120cm)</span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={conGiunti}
                  onChange={(e) => setConGiunti(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[hsl(220,90%,56%)]"></div>
              </label>
            </div>
          </div>

          {/* Griglia Segmenti */}
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🛤️</span> Griglia Segmenti Tracciato
              </h3>
              <button
                type="button"
                onClick={handleAddSegment}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer flex items-center gap-1"
              >
                <span>+</span> Aggiungi
              </button>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  onClick={() => setSelectedSegmentId(seg.id)}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 relative cursor-pointer select-none ${
                    selectedSegmentId === seg.id
                      ? "bg-[hsl(220,90%,56%)/0.08] border-[hsl(220,90%,56%)]"
                      : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  }`}
                >
                  {/* Riga Superiore Segmento */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-white/40">#{idx + 1}</span>
                      <input
                        type="text"
                        value={seg.nome}
                        onChange={(e) => handleUpdateSegment(seg.id, "nome", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent text-xs font-bold text-white outline-none border-b border-transparent focus:border-white/20 pb-0.5 max-w-[120px]"
                        placeholder="Nome Segmento"
                      />
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleMoveSegment(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 text-[10px] bg-white/5 border border-white/5 rounded hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                        title="Sposta Su"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSegment(idx, "down")}
                        disabled={idx === segments.length - 1}
                        className="p-1 text-[10px] bg-white/5 border border-white/5 rounded hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer"
                        title="Sposta Giù"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSegment(seg.id)}
                        className="p-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded cursor-pointer"
                        title="Rimuovi"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Riga Inferiore Parametri Segmento */}
                  <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 block">Lunghezza (cm)</label>
                      <input
                        type="number"
                        value={seg.lunghezza}
                        onChange={(e) =>
                          handleUpdateSegment(seg.id, "lunghezza", Math.max(10, parseInt(e.target.value) || 10))
                        }
                        className="w-full px-2 py-1 rounded-lg bg-bg border border-border text-xs text-white outline-none focus:border-brand"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 block">Svolta Successiva</label>
                      <select
                        value={seg.svolta}
                        onChange={(e) => handleUpdateSegment(seg.id, "svolta", e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-bg border border-border text-xs text-white outline-none cursor-pointer focus:border-brand"
                      >
                        <option value="Nessuna">Nessuna (Fine)</option>
                        <option value="Destra">Curva DX (90°)</option>
                        <option value="Sinistra">Curva SX (90°)</option>
                        <option value="Alto">Curva in Alto (90°)</option>
                        <option value="Basso">Curva in Basso (90°)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3D Canvas e Computo Metrico (Colonna DX) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Visualizzatore 3D */}
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📐</span> Vista 3D Tracciato
              </h3>
              <button
                type="button"
                onClick={handleResetCamera}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
              >
                Resetta Vista
              </button>
            </div>

            <div
              className="w-full h-[360px] rounded-xl overflow-hidden relative border border-white/5"
              style={{ background: "hsl(228, 39%, 8%)" }}
            >
              <Canvas
                camera={{ position: [3, 3, 4], fov: 45 }}
                shadows
                gl={{ preserveDrawingBuffer: true }}
              >
                <ambientLight intensity={0.9} />
                <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
                <directionalLight position={[-10, 10, -10]} intensity={0.5} />
                
                <RouteScene
                  calculatedPath={calculatedPath}
                  w={w3d}
                  h={h3d}
                  t={t3d}
                  selectedSegmentId={selectedSegmentId}
                  setSelectedSegmentId={setSelectedSegmentId}
                />

                <Grid
                  renderOrder={-1}
                  position={[0, -0.05, 0]}
                  args={[15, 15]}
                  cellSize={0.5}
                  cellThickness={0.5}
                  cellColor="hsl(220, 20%, 22%)"
                  sectionSize={1.5}
                  sectionThickness={1}
                  sectionColor="hsl(220, 20%, 35%)"
                  fadeDistance={30}
                />
                
                <OrbitControls ref={controlsRef} />
              </Canvas>
              
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-white/50 pointer-events-none select-none border border-white/5">
                Trascina per ruotare • Due dita / Rotella per zoom
              </div>
            </div>
          </div>

          {/* Card Computo Metrico di Sintesi */}
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <span>📊</span> Sintesi Computo Metrico Stimato
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Lunghezza Totale</span>
                <span className="text-sm font-bold text-white">{computations.totalLengthM.toFixed(2)} m</span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Curve a 90°</span>
                <span className="text-sm font-bold text-white">{computations.totalElbows} pezzi</span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Superficie Silicato</span>
                <span className="text-sm font-bold text-white">{computations.totalPlatesAreaM2.toFixed(2)} m²</span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Lastre Intere (~Fogli)</span>
                <span className="text-sm font-bold text-white">~{computations.totalSheets} pezzi</span>
                <span className="text-[8px] text-white/30 block mt-0.5">
                  Basato su lastre {selectedMaterial?.length_mm ? selectedMaterial.length_mm / 1000 : 2.0}x
                  {selectedMaterial?.width_mm ? selectedMaterial.width_mm / 1000 : 1.2}m
                </span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Viti Totali</span>
                <span className="text-sm font-bold text-white">~{computations.totalScrews} pezzi</span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Coprigiunti Silicato</span>
                <span className="text-sm font-bold text-white">{computations.totalProfileM.toFixed(2)} m</span>
              </div>
            </div>
            
            <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300/80 leading-relaxed">
              💡 <strong>Nota per l'installatore:</strong> I coprigiunti esterni in lastra di silicato vanno incollati e avvitati a cavallo di ogni giunzione. La canalizzazione deve essere supportata da staffe di sostegno (barre asolate e pendini) a interasse massimo di 120 cm.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
