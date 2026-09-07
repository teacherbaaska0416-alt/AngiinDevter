import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url) {
  if (!url) return "";
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase тохиргоо дутуу байна. .env.example-ийг .env болгон хуулж, VITE_SUPABASE_URL болон VITE_SUPABASE_ANON_KEY-г оруулна уу."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
