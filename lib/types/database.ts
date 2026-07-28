/**
 * ============================================
 * Tipi TypeScript per lo schema PostgreSQL
 * Database: Supabase - Gestionale Spese & Pagamenti
 * ============================================
 */

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  notes?: string | null;
  description?: string | null;
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
  is_income: boolean;
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
  recurrence: "one-time" | "weekly" | "monthly" | "yearly";
  category_id: string | null; // FK -> expense_categories.id
  supplier_id: string | null; // FK -> suppliers.id
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  type: "income" | "need" | "want" | "emergency";
  amount: number;
  label: string;
  periodicity: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  is_estimated: boolean;
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
  supplier_id: string;
  expense_id: string | null;
  schedule_id: string | null;
  title: string;
  file_url: string;
  provider: "local" | "gdrive" | "onedrive";
  file_size: number | null;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
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
          notes?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          notes?: string | null;
          description?: string | null;
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
          is_income?: boolean;
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
          is_income?: boolean;
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
          recurrence?: "one-time" | "weekly" | "monthly" | "yearly";
          category_id?: string | null;
          supplier_id?: string | null;
          google_event_id?: string | null;
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
          recurrence?: "one-time" | "weekly" | "monthly" | "yearly";
          category_id?: string | null;
          supplier_id?: string | null;
          google_event_id?: string | null;
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
          }
        ];
      };
      budgets: {
        Row: Budget;
        Insert: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          type: "income" | "need" | "want" | "emergency";
          amount: number;
          label: string;
          periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
          is_estimated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          type?: "income" | "need" | "want" | "emergency";
          amount?: number;
          label?: string;
          periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
          is_estimated?: boolean;
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
          supplier_id: string;
          expense_id?: string | null;
          schedule_id?: string | null;
          title: string;
          file_url: string;
          provider?: "local" | "gdrive" | "onedrive";
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          supplier_id?: string;
          expense_id?: string | null;
          schedule_id?: string | null;
          title?: string;
          file_url?: string;
          provider?: "local" | "gdrive" | "onedrive";
          file_size?: number | null;
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
