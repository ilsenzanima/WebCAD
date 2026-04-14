/**
 * ============================================
 * Tipi TypeScript per lo schema PostgreSQL
 * Database: Supabase - WebCAD Antincendio
 * ============================================
 * Generato manualmente dal PRD (Sezione 3).
 * In futuro potrà essere rigenerato con: npx supabase gen types typescript
 */

// ----- Enum Types -----

export type ElementType = "wall" | "duct" | "ceiling";

export type StructuralPointType = "stud" | "pendant";

// ----- Table Row Types -----

export interface Project {
  id: string; // UUID
  name: string;
  client_info: Record<string, unknown> | null; // JSONB
  created_at?: string;
  updated_at?: string;
}

export interface Level {
  id: string; // UUID
  project_id: string; // FK -> projects.id
  name?: string;
  elevation_z: number; // Z-index per attraversamento multi-piano
  scale_ratio: number | null; // Rapporto pixel -> mm (calibrazione)
  plan_image_url: string | null;
  created_at?: string;
}

export interface ElementMaster {
  id: string; // UUID
  level_id: string; // FK -> levels.id
  type: ElementType;
  total_length: number;
  thickness: number;
  geometry: Record<string, unknown>; // JSONB - coordinate Konva path/line
  structural_settings: {
    pitch?: number;
    double_stud?: boolean;
    [key: string]: unknown;
  };
  created_at?: string;
}

export interface OpeningDetail {
  id: string; // UUID
  element_master_id: string; // FK -> elements_master.id
  width: number;
  height: number;
  dist_floor: number; // Distanza dal pavimento
  dist_start_node: number; // Distanza dal nodo iniziale
}

export interface ElementComponent {
  id: string; // UUID
  master_id: string; // FK -> elements_master.id
  cut_length: number;
  cut_width: number;
  sequence_index: number;
}

export interface StructuralPoint {
  id: string; // UUID
  master_id: string; // FK -> elements_master.id
  type: StructuralPointType;
  offset_x: number;
  offset_y: number;
  is_manual: boolean;
}

export interface Material {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  description: string | null;
  category: string | null;
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  unit_cost: number | null;
  unit: string | null;
  stock_qty: number | null;
  supplier: string | null;
  sku: string | null;
  is_active: boolean | null;
  created_at?: string;
  updated_at?: string;
}

// ----- Database Schema (per Supabase Client tipizzato) -----

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Project, "id">>;
      };
      levels: {
        Row: Level;
        Insert: Omit<Level, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Level, "id">>;
      };
      elements_master: {
        Row: ElementMaster;
        Insert: Omit<ElementMaster, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<ElementMaster, "id">>;
      };
      openings_details: {
        Row: OpeningDetail;
        Insert: Omit<OpeningDetail, "id"> & { id?: string };
        Update: Partial<Omit<OpeningDetail, "id">>;
      };
      element_components: {
        Row: ElementComponent;
        Insert: Omit<ElementComponent, "id"> & { id?: string };
        Update: Partial<Omit<ElementComponent, "id">>;
      };
      structural_points: {
        Row: StructuralPoint;
        Insert: Omit<StructuralPoint, "id"> & { id?: string };
        Update: Partial<Omit<StructuralPoint, "id">>;
      };
      materials: {
        Row: Material;
        Insert: Omit<Material, "id" | "user_id" | "created_at" | "updated_at"> & {
          id?: string;
          user_id?: string;
        };
        Update: Partial<Omit<Material, "id" | "user_id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      element_type: ElementType;
      structural_point_type: StructuralPointType;
    };
  };
}
