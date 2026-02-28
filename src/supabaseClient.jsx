import { createClient } from "@supabase/supabase-js";

/*
  ==========================================================
  ARM PAL — SUPABASE CLIENT (FULL REPLACEMENT)
  ==========================================================
  Clean, minimal, correct configuration.
  No experimental options.
  No extra settings.
  ==========================================================
*/

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ewlwkasjtwsfemqnkrkp.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHdrYXNqdHdzZmVtcW5rcmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4ODM3MjQsImV4cCI6MjA3ODQ1OTcyNH0.mG3gJVhSZiGTZx6MFwV0GYq5Xon6dCNsSQLYd230itc";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: localStorage,
    },
  }
);
