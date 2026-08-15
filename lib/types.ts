// ============================================================
// IterUp — tipi TypeScript generati da /schema.sql
// ------------------------------------------------------------
// CONGELATO dopo la Fase 0 (vedi CLAUDE.md regola 2).
//
// Scritti a mano per rispecchiare esattamente /schema.sql (schema
// CANONICO, già applicato su Supabase), nello stesso formato
// prodotto da `supabase gen types typescript`. Se il progetto
// Supabase viene linkato in futuro, questo file può essere
// rigenerato con:
//   supabase gen types typescript --project-id <ref> > lib/types.ts
// Se manca un campo, segnalalo al supervisore invece di modificare
// questo file da un modulo specializzato.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          sex: "m" | "f" | null;
          birth_date: string | null;
          height_cm: number | null;
          activity_level:
            | "sedentario"
            | "leggero"
            | "moderato"
            | "attivo"
            | "molto_attivo"
            | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          sex?: "m" | "f" | null;
          birth_date?: string | null;
          height_cm?: number | null;
          activity_level?:
            | "sedentario"
            | "leggero"
            | "moderato"
            | "attivo"
            | "molto_attivo"
            | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          sex?: "m" | "f" | null;
          birth_date?: string | null;
          height_cm?: number | null;
          activity_level?:
            | "sedentario"
            | "leggero"
            | "moderato"
            | "attivo"
            | "molto_attivo"
            | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_targets: {
        Row: {
          id: string;
          user_id: string;
          mode: "loss" | "maintain" | "gain";
          daily_kcal: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: "loss" | "maintain" | "gain";
          daily_kcal: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: "loss" | "maintain" | "gain";
          daily_kcal?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      foods: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          kcal_100g: number;
          protein_100g: number;
          carbs_100g: number;
          fat_100g: number;
          fiber_100g: number | null;
          source: string | null;
          source_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          kcal_100g: number;
          protein_100g: number;
          carbs_100g: number;
          fat_100g: number;
          fiber_100g?: number | null;
          source?: string | null;
          source_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          kcal_100g?: number;
          protein_100g?: number;
          carbs_100g?: number;
          fat_100g?: number;
          fiber_100g?: number | null;
          source?: string | null;
          source_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          food_id: string;
          quantity_g: number;
          meal_type: "colazione" | "pranzo" | "cena" | "spuntino";
          logged_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_id: string;
          quantity_g: number;
          meal_type: "colazione" | "pranzo" | "cena" | "spuntino";
          logged_at?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          food_id?: string;
          quantity_g?: number;
          meal_type?: "colazione" | "pranzo" | "cena" | "spuntino";
          logged_at?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      body_metrics: {
        Row: {
          id: string;
          user_id: string;
          recorded_at: string;
          weight_kg: number | null;
          neck_cm: number | null;
          chest_cm: number | null;
          waist_cm: number | null;
          thigh_cm: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_at?: string;
          weight_kg?: number | null;
          neck_cm?: number | null;
          chest_cm?: number | null;
          waist_cm?: number | null;
          thigh_cm?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          recorded_at?: string;
          weight_kg?: number | null;
          neck_cm?: number | null;
          chest_cm?: number | null;
          waist_cm?: number | null;
          thigh_cm?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          recorded_at: string;
          steps: number | null;
          source: string | null;
          workout_type: string | null;
          workout_minutes: number | null;
          calories_burned: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_at?: string;
          steps?: number | null;
          source?: string | null;
          workout_type?: string | null;
          workout_minutes?: number | null;
          calories_burned?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          recorded_at?: string;
          steps?: number | null;
          source?: string | null;
          workout_type?: string | null;
          workout_minutes?: number | null;
          calories_burned?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "boolean" | "quantity";
          unit: string | null;
          target_value: number | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "boolean" | "quantity";
          unit?: string | null;
          target_value?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "boolean" | "quantity";
          unit?: string | null;
          target_value?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          id: string;
          habit_id: string;
          user_id: string;
          recorded_at: string;
          completed: boolean | null;
          value: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          habit_id: string;
          user_id: string;
          recorded_at?: string;
          completed?: boolean | null;
          value?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          habit_id?: string;
          user_id?: string;
          recorded_at?: string;
          completed?: boolean | null;
          value?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          goal_type: "weight" | "habit_streak" | "activity" | "custom";
          title: string;
          target_value: number | null;
          target_date: string | null;
          status: "in_corso" | "raggiunto" | "abbandonato" | null;
          created_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_type: "weight" | "habit_streak" | "activity" | "custom";
          title: string;
          target_value?: number | null;
          target_date?: string | null;
          status?: "in_corso" | "raggiunto" | "abbandonato" | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_type?: "weight" | "habit_streak" | "activity" | "custom";
          title?: string;
          target_value?: number | null;
          target_date?: string | null;
          status?: "in_corso" | "raggiunto" | "abbandonato" | null;
          created_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
