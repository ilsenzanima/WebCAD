/**
 * ============================================
 * Tipi TypeScript per lo schema PostgreSQL
 * Database: Supabase - Gestionale Spese & Pagamenti
 * ============================================
 */

export interface FamilyMember {
  user_id: string;
  display_name: string;
  role: "admin" | "member";
  created_at: string;
}

export interface SketchPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface SketchStroke {
  color: string;
  size: number;
  eraser: boolean;
  points: SketchPoint[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "bozza" | "in_corso" | "finito";
  notes_html: string | null;
  created_at: string;
}

export interface ProjectSketch {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  strokes: SketchStroke[];
  drive_file_id: string | null;
  drive_link: string | null;
  drive_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMaterial {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit_price: number | null;
  link: string | null;
  notes: string | null;
  purchased: boolean;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  loyalty_card_number: string | null;
  loyalty_card_format: string | null; // formato ZXing (es. "QR_CODE", "CODE_128", "EAN_13"), per rigenerare la tessera a schermo
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ShoppingProduct {
  id: string;
  name: string;
  category: string | null;
  store_id: string | null;
  aisle: string | null;
  default_unit: string | null;
  shelf_life_days: number | null;
  is_off_list: boolean; // articolo "fuori lista": si prende spesso in più, a prescindere dalla lista attiva
  created_by: string | null;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  status: "open" | "completed";
  shopping_date: string | null;
  store_id: string | null;
  total_amount: number | null;
  expense_id: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  product_id: string;
  brand_id: string | null; // marca scelta, se il prodotto ne ha piu' di una censita in vetrina
  quantity: number | null;
  unit: string | null;
  price: number | null;
  is_checked: boolean;
  checked_at: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  shopping_products?: ShoppingProduct;
  shopping_product_brands?: ShoppingProductBrand | null;
}

export interface NutrimentsSummary {
  serving_size: string | null;
  energy_kcal_100g: number | null;
  fat_100g: number | null;
  saturated_fat_100g: number | null;
  carbohydrates_100g: number | null;
  sugars_100g: number | null;
  fiber_100g: number | null;
  proteins_100g: number | null;
  salt_100g: number | null;
  energy_kcal_serving: number | null;
  fat_serving: number | null;
  saturated_fat_serving: number | null;
  carbohydrates_serving: number | null;
  sugars_serving: number | null;
  fiber_serving: number | null;
  proteins_serving: number | null;
  salt_serving: number | null;
}

export interface ShoppingProductBrand {
  id: string;
  product_id: string;
  brand_name: string;
  barcode: string | null;
  rating: number | null;
  nutri_score: "A" | "B" | "C" | "D" | "E" | null;
  nova_group: 1 | 2 | 3 | 4 | null;
  eco_score: "A" | "B" | "C" | "D" | "E" | null;
  image_url: string | null;
  ingredients_text: string | null;
  allergens: string | null;
  nutriments: NutrimentsSummary | null;
  additives: string | null;
  traces: string | null;
  labels: string | null;
  package_quantity: string | null;
  off_categories: string | null;
  image_packaging_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  monthly_budget: number | null; // limite mensile impostato per l'intera categoria (es. "Utenze: 300€ di media")
  budget_percent: number | null; // in alternativa a monthly_budget: percentuale delle entrate mensili previste (0-100)
  budget_type: "need" | "want" | "emergency" | null; // classificazione Bisogno/Desiderio/Imprevisto ai fini della ripartizione 50/30/20
  created_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  is_utility: boolean; // fornitore di un'utenza (luce, gas, acqua...) con consumi tracciabili
  consumption_unit: string | null; // es. "kWh", "m3", "L"
  is_active: boolean; // contratto in corso (false = chiuso/disdetto)
  contract_closed_at: string | null;
  store_id: string | null; // collegamento opzionale al Negozio condiviso corrispondente (vetrina/lista della spesa)
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit_card" | "other";
  initial_balance: number;
  color: string;
  is_active: boolean;
  is_default: boolean; // usato per precompilare la selezione conto in Spese/Entrate e nel saldo delle Scadenze
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceAdjustment {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  balance: number; // saldo reale osservato a questa data (es. letto dall'app della banca)
  note: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string; // fallback testuale
  description: string | null;
  date: string;
  category_id: string | null; // FK -> expense_categories.id
  supplier_id: string | null; // FK -> suppliers.id
  schedule_id: string | null; // FK -> payment_schedules.id (se generata pagando una scadenza)
  budget_id: string | null; // FK -> budgets.id (se generata confermando una voce di budget)
  account_id: string | null; // FK -> accounts.id
  consumption_value: number | null; // consumo del periodo (unita' definita da suppliers.consumption_unit)
  period_start: string | null; // primo giorno del mese di inizio del periodo di copertura della bolletta
  period_end: string | null; // primo giorno del mese di fine (= period_start per un singolo mese)
  is_income: boolean;
  is_emergency: boolean; // segnata come imprevisto al momento della registrazione, a prescindere dal tipo della categoria
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedule {
  id: string;
  user_id: string;
  amount: number;
  category: string; // fallback testuale
  description: string | null;
  due_date: string;
  is_paid: boolean;
  recurrence: "one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";
  category_id: string | null; // FK -> expense_categories.id
  supplier_id: string | null; // FK -> suppliers.id
  budget_id: string | null; // FK -> budgets.id (legacy: collegamento a una vecchia voce di budget)
  google_event_id: string | null;
  was_rescheduled: boolean; // true se spostata col pulsante "Ripianifica" dopo essere risultata scaduta
  end_month: number | null; // 1-12, ultimo mese in cui questa scadenza ricorrente e' attiva (es. fine finanziamento)
  end_year: number | null;
  is_estimated: boolean; // true se l'importo e' una stima e non un valore certo
  is_income: boolean; // true per un impegno ricorrente di entrata (es. stipendio), invece di un'uscita
  generated_from_schedule_id: string | null; // FK -> payment_schedules.id, se creata automaticamente saldando quella scadenza ricorrente
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  supplier_id: string | null; // FK -> suppliers.id, ereditato dalla spesa reale quando si conferma il pagamento
  type: "income" | "need" | "want" | "emergency";
  amount: number;
  label: string;
  periodicity: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  is_estimated: boolean;
  end_month: number | null; // 1-12, ultimo mese in cui la voce e' attiva (es. fine mutuo/finanziamento)
  end_year: number | null;
  day_of_month: number | null; // 1-31, giorno del mese in cui la voce ricorrente e' fissata (es. affitto il 5)
  created_at: string;
  updated_at: string;
}

export interface BudgetOverride {
  id: string;
  user_id: string;
  budget_id: string;
  year: number;
  month: number; // 1-12
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierDocument {
  id: string;
  user_id: string;
  supplier_id: string | null;
  expense_id: string | null;
  schedule_id: string | null;
  title: string;
  file_url: string;
  provider: "local" | "gdrive" | "onedrive";
  file_size: number | null;
  doc_type: "contratto" | "bolletta" | "altro";
  gdrive_file_id: string | null; // id del file su Google Drive, per poterlo spostare tra cartelle
  document_year: number | null; // anno scelto per il documento, usato per la sottocartella Fornitore/Anno
  created_at: string;
}

// ----- Database Schema (per Supabase Client tipizzato) -----

export interface Database {
  public: {
    Tables: {
      expense_categories: {
        Row: ExpenseCategory;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          monthly_budget?: number | null;
          budget_percent?: number | null;
          budget_type?: "need" | "want" | "emergency" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          monthly_budget?: number | null;
          budget_percent?: number | null;
          budget_type?: "need" | "want" | "emergency" | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: Supplier;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          is_utility?: boolean;
          consumption_unit?: string | null;
          is_active?: boolean;
          contract_closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_utility?: boolean;
          consumption_unit?: string | null;
          is_active?: boolean;
          contract_closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          category: string;
          description?: string | null;
          date?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          schedule_id?: string | null;
          budget_id?: string | null;
          account_id?: string | null;
          consumption_value?: number | null;
          period_start?: string | null;
          period_end?: string | null;
          is_income?: boolean;
          is_emergency?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          category?: string;
          description?: string | null;
          date?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          schedule_id?: string | null;
          budget_id?: string | null;
          account_id?: string | null;
          consumption_value?: number | null;
          period_start?: string | null;
          period_end?: string | null;
          is_income?: boolean;
          is_emergency?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "payment_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      accounts: {
        Row: Account;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type?: "checking" | "savings" | "cash" | "credit_card" | "other";
          initial_balance?: number;
          color?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "checking" | "savings" | "cash" | "credit_card" | "other";
          initial_balance?: number;
          color?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      account_balance_adjustments: {
        Row: AccountBalanceAdjustment;
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          date: string;
          balance: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          date?: string;
          balance?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_balance_adjustments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_schedules: {
        Row: PaymentSchedule;
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          category: string;
          description?: string | null;
          due_date: string;
          is_paid?: boolean;
          recurrence?: "one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";
          category_id?: string | null;
          supplier_id?: string | null;
          budget_id?: string | null;
          google_event_id?: string | null;
          was_rescheduled?: boolean;
          end_month?: number | null;
          end_year?: number | null;
          is_estimated?: boolean;
          is_income?: boolean;
          generated_from_schedule_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          category?: string;
          description?: string | null;
          due_date?: string;
          is_paid?: boolean;
          recurrence?: "one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";
          category_id?: string | null;
          supplier_id?: string | null;
          budget_id?: string | null;
          google_event_id?: string | null;
          was_rescheduled?: boolean;
          end_month?: number | null;
          end_year?: number | null;
          is_estimated?: boolean;
          is_income?: boolean;
          generated_from_schedule_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_schedules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_schedules_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_schedules_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          }
        ];
      };
      budgets: {
        Row: Budget;
        Insert: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          type: "income" | "need" | "want" | "emergency";
          amount: number;
          label: string;
          periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
          is_estimated?: boolean;
          end_month?: number | null;
          end_year?: number | null;
          day_of_month?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          type?: "income" | "need" | "want" | "emergency";
          amount?: number;
          label?: string;
          periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
          is_estimated?: boolean;
          end_month?: number | null;
          end_year?: number | null;
          day_of_month?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          }
        ];
      };
      budget_overrides: {
        Row: BudgetOverride;
        Insert: {
          id?: string;
          user_id?: string;
          budget_id: string;
          year: number;
          month: number;
          amount: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          budget_id?: string;
          year?: number;
          month?: number;
          amount?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_overrides_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          }
        ];
      };
      supplier_documents: {
        Row: SupplierDocument;
        Insert: {
          id?: string;
          user_id?: string;
          supplier_id?: string | null;
          expense_id?: string | null;
          schedule_id?: string | null;
          title: string;
          file_url: string;
          provider?: "local" | "gdrive" | "onedrive";
          file_size?: number | null;
          doc_type?: "contratto" | "bolletta" | "altro";
          gdrive_file_id?: string | null;
          document_year?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          supplier_id?: string | null;
          expense_id?: string | null;
          schedule_id?: string | null;
          title?: string;
          file_url?: string;
          provider?: "local" | "gdrive" | "onedrive";
          file_size?: number | null;
          doc_type?: "contratto" | "bolletta" | "altro";
          gdrive_file_id?: string | null;
          document_year?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_google_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          access_token?: string;
          refresh_token?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
