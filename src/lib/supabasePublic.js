/**
 * Public Supabase credentials (safe for the browser).
 * The anon key is not a secret; RLS is the authorization layer.
 * Server voice tools reuse this same public credential + the user JWT.
 */
export const SUPABASE_PUBLIC_URL =
  "https://ewlwkasjtwsfemqnkrkp.supabase.co";

export const SUPABASE_PUBLIC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHdrYXNqdHdzZmVtcW5rcmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4ODM3MjQsImV4cCI6MjA3ODQ1OTcyNH0.mG3gJVhSZiGTZx6MFwV0GYq5Xon6dCNsSQLYd230itc";
