// Dichiarazioni minime per cascade-core (non pubblica un proprio index.d.ts
// per il pacchetto principale, solo per types/StandardLibraryIntellisense.ts).
// Copre solo la superficie usata da ModelEditorClient.
declare module "cascade-core" {
  export interface CascadeMeshFace {
    vertex_coord: number[];
    normal_coord: number[];
    tri_indexes: number[];
    number_of_triangles: number;
  }

  export interface CascadeMeshEdge {
    vertex_coord: number[];
  }

  export interface CascadeEvaluateResult {
    meshData: { faces: CascadeMeshFace[]; edges: CascadeMeshEdge[] } | null;
    sceneOptions: Record<string, unknown>;
  }

  export class CascadeEngine {
    constructor(options: { workerUrl: string });
    init(): Promise<void>;
    evaluate(
      code: string,
      options?: { guiState?: Record<string, unknown>; maxDeviation?: number; sceneOptions?: Record<string, unknown> }
    ): Promise<CascadeEvaluateResult>;
    meshHistoryStep(stepIndex: number, maxDeviation?: number): Promise<unknown>;
    exportSTEP(): Promise<string>;
    importFiles(files: unknown): void;
    on(event: string, handler: (payload: any) => void): void;
    off(event: string, handler?: (payload: any) => void): void;
    readonly isReady: boolean;
    readonly isWorking: boolean;
    dispose(): void;
  }

  export class OpenSCADTranspiler {
    transpile(code: string): string;
  }
}
