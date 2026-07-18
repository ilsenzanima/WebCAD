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
  description: string | null;
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
  created_at: string;
  updated_at: string;
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
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
