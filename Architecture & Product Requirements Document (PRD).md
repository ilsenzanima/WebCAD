# 🏗️ Architecture & Product Requirements Document (PRD)

---

> **Project:** Fire Protection WebCAD & Material Optimizer
> 
> **Target Audience:** AI Development Agent (Antigravity) / Dev Team
> 
> **Goal:** Build a cloud-based, multi-platform CAD application for fire protection engineering, featuring parametric structural modeling, 1D/2D material nesting, and real-time BoM (Bill of Materials) generation.

---

## 0. AI Agent Rules & Repository Setup (Regole per l'IA)

The AI agent executing this project **MUST** adhere strictly to the following rules:

* 🇮🇹 **Language (Lingua):** ALL communication with the user must be in **Italian**.
* 🔄 **Version Control (GitHub):** All Git commit messages MUST be written in **Italian** to allow the user to easily track progress and changes (e.g., `feat: aggiunto algoritmo per calcolo sfrido`).
* 🔒 **Sensitive Data & Sample Folder (`.gitignore`):**
  * The AI must create a local directory named `_sample_data/` at the root of the project. The user will use this folder to drop PDFs, sample floor plans, or technical documentation for the AI to read.
  * The `.gitignore` file MUST explicitly exclude `_sample_data/`, `.env`, `.env.local`, and any other file containing sensitive credentials to prevent accidental uploads to GitHub.

---

## 1. System Architecture & Tech Stack

The application must be built using a modern, serverless ecosystem to ensure scalability and real-time capabilities.

* **Framework Core:** Next.js 14+ (App Router) with React 18+.
* **Styling:** Tailwind CSS (utility-first for fast responsive UI).
* **State Management:** Zustand (for complex Canvas state and drag-and-drop operations) + React Query (for server state and Supabase data fetching).
* **Backend & Auth (BaaS):** Supabase (PostgreSQL). Utilization of Row Level Security (RLS) for multi-tenant data isolation.
* **2D Graphics Engine:** `react-konva` (Konva.js wrapper for React). Essential for declarative canvas rendering, performance optimization (Layering), and event handling (pointer/touch).
* **3D Graphics Engine:** `@react-three/fiber` and `@react-three/drei` for 3D duct visualization and collision debugging.
* **Version Control & CI/CD:** GitHub repository connected to Vercel for automated deployments.

---

## 2. Core Modules & Algorithmic Requirements

### 2.1. Canvas Engine & Coordinate System (Office Mode)
* **Coordinate Space:** Global coordinates (X, Y) for the Canvas. Elements have Local coordinates relative to their parent container.
* **Scale Matrix (Calibration):** User defines a vector V(p1, p2) in pixels and assigns a real-world length L_real (meters/mm). The system stores the ratio R = L_real / |V| globally for the active `level_id`.
* **Viewport:** The Canvas must be `100vw x 100vh`. UI elements must be implemented as floating overlays (absolute positioning) to maximize the drawing area.

### 2.2. Parametric Structural Logic (Auto-Pitch)
* For linear elements (`type: wall`), the system calculates structural supports (studs/pendants) based on a `pitch` parameter (e.g., 600 mm, 400 mm).
* **Algorithm:** Generate an array of structural points: Pn = Pstart + n * pitch.
* **Manual Override:** If a point is dragged, its `is_manual` flag becomes `true`, and its (X,Y) offset is explicitly stored. The algorithm must recalculate validation: if distance between Pn and Pn+1 > pitch_max, throw a UI warning.

### 2.3. Nesting Engine & BoM Generation
* **1D Bin Packing (Linear Profiles):** Use a greedy algorithm (e.g., First Fit Decreasing) to pack required stud lengths into standard commercial profile lengths (e.g., 3000 mm).
* **2D Guillotine / MaxRects (Boards):** Algorithm for calcium silicate boards.
* **Kerf Parameter:** Every cut operation MUST subtract the globally defined `settings_global.blade_thickness` (e.g., 3 mm or 4 mm) from the available material pool.
* **Pass-through Computation (Intersection):** If an element E1 (Duct) intersects E2 (Wall), Length_E1_Total = Length_E1_Visual + Thickness_E2.

---

## 3. Database Schema Definition (Supabase / PostgreSQL)

Ensure strict typing and Foreign Key constraints. Use `UUID v4` for all primary keys.

* 🗂️ **`projects`**
  * `id` (UUID, PK)
  * `name` (VARCHAR)
  * `client_info` (JSONB)

* 🏢 **`levels`** *(Multi-floor management)*
  * `id` (UUID, PK)
  * `project_id` (UUID, FK -> projects.id)
  * `elevation_z` (FLOAT) - Z-index for multi-floor crossing.
  * `scale_ratio` (FLOAT) - Pixels to mm ratio.
  * `plan_image_url` (TEXT)

* 🧱 **`elements_master`** *(The immutable geometry)*
  * `id` (UUID, PK)
  * `level_id` (UUID, FK -> levels.id)
  * `type` (ENUM: 'wall', 'duct', 'ceiling')
  * `total_length` (FLOAT)
  * `thickness` (FLOAT)
  * `geometry` (JSONB) - Contains Konva path/line coordinates.
  * `structural_settings` (JSONB) - `{ pitch: 600, double_stud: true }`

* 🕳️ **`openings_details`** *(Voids and passages)*
  * `id` (UUID, PK)
  * `element_master_id` (UUID, FK -> elements_master.id)
  * `width` (FLOAT), `height` (FLOAT)
  * `dist_floor` (FLOAT), `dist_start_node` (FLOAT) - Spatial references.

* 🧩 **`element_components`** *(The cut pieces for manufacturing)*
  * `id` (UUID, PK)
  * `master_id` (UUID, FK -> elements_master.id)
  * `cut_length` (FLOAT), `cut_width` (FLOAT)
  * `sequence_index` (INT)

* 📌 **`structural_points`**
  * `id` (UUID, PK)
  * `master_id` (UUID, FK -> elements_master.id)
  * `type` (ENUM: 'stud', 'pendant')
  * `offset_x` (FLOAT), `offset_y` (FLOAT)
  * `is_manual` (BOOLEAN)

---

## 4. Execution Roadmap (Development Phases)

Antigravity agent should execute the following phases sequentially:

### 🚀 Epic 0: Scaffolding, DB Init & Setup Rules
* Read section "0. AI Agent Rules" and configure the project accordingly (Always speak Italian).
* Create `_sample_data/` folder and configure `.gitignore` to exclude it, along with `.env` files.
* Initialize Next.js App Router project.
* Install Tailwind, Zustand, Supabase-js, React-Konva.
* Apply PostgreSQL schema to Supabase and configure RLS.

### 🔐 Epic 1: Auth & Catalog Integration
* Implement Supabase Auth (Email/Password or SSO).
* Create CRUD interfaces for importing Warehouse Materials (assigning physical L x W x T properties).

### 🖥️ Epic 2: The 2D Canvas Engine (Office MVP)
* Implement Full-screen Canvas layout.
* Build Image Upload & Scale Calibration tool (Math: distance formula between 2 points -> ratio computation).
* Implement `react-konva` drawing tools (Lines, Polygons).

### ⚙️ Epic 3: Parametric Engine & Openings
* Build the Auto-Pitch algorithm for stud placement.
* Implement drag-and-drop for structural points (`is_manual` override).
* Create the Openings (varchi) logic: projecting 1D positions onto the 2D wall line.

### 🏢 Epic 4: Verticality & Intersections
* Implement Level switching.
* Algorithm to detect Line-Line intersections (Duct crossing a Wall) and apply the `Pass-through Computation` (add thickness to total length).

### ✂️ Epic 5: Nesting & Output
* Implement 1D/2D Bin Packing algorithms factoring in the Kerf parameter.
* Generate PDF/CSV exports for the Workshop (Cut Lists) and Field (Installation Plans).