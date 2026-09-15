import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLIC_ANON_KEY,
  SUPABASE_PUBLIC_URL,
} from "./lib/supabasePublic";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || SUPABASE_PUBLIC_URL;

const SUPABASE_ANON_KEY = SUPABASE_PUBLIC_ANON_KEY;

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: localStorage,
    },
  }
);
