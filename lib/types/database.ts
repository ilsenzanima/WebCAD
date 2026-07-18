/**
 * ============================================
 * Tipi TypeScript per lo schema PostgreSQL
 * Database: Supabase - Gestionale Spese & Pagamenti
 * ============================================
 */

export interface Database {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          category: string;
          description: string | null;
          date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          category: string;
          description?: string | null;
          date?: string;
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_schedules: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          category: string;
          description: string | null;
          due_date: string;
          is_paid: boolean;
          recurrence: "one-time" | "weekly" | "monthly" | "yearly";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          category: string;
          description?: string | null;
          due_date: string;
          is_paid?: boolean;
          recurrence?: "one-time" | "weekly" | "monthly" | "yearly";
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

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type PaymentSchedule = Database["public"]["Tables"]["payment_schedules"]["Row"];
