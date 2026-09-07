import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase тохиргоо дутуу байна. .env файлдаа VITE_SUPABASE_URL болон VITE_SUPABASE_ANON_KEY-г тохируулна уу (.env.example-ийг харна уу)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
