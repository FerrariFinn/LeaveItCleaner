import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in backend/.env");

// Server-side only: the secret key bypasses RLS and must never reach the browser.
export const supabase = createClient(url, key, { auth: { persistSession: false } });

export type Category = { id: string; label: string; sort_order: number };

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return data;
}
