import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");

// ─── Database types ─────────────────────────────────────────────
export interface LogEntry {
  id: string;
  user_id: string | null;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  image_url: string | null;
  created_at: string;
}
