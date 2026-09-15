import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLIC_ANON_KEY,
  SUPABASE_PUBLIC_URL,
} from "../../src/lib/supabasePublic.js";

export function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice(7).trim();
}

export function getPublicSupabaseConfig() {
  const env = globalThis.process?.env || {};
  const url =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    SUPABASE_PUBLIC_URL;
  const anon =
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    SUPABASE_PUBLIC_ANON_KEY;
  return { url, anon };
}

/**
 * User-scoped client: public anon key + the caller's JWT.
 * RLS applies. Never uses the service role.
 */
export function createUserClient(accessToken) {
  const { url, anon } = getPublicSupabaseConfig();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    accessToken: async () => accessToken,
  });
}

export function createAuthClient() {
  const { url, anon } = getPublicSupabaseConfig();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return { error: { status: 401, message: "Sign in to use ArmPal voice." } };
  }
  const { url, anon } = getPublicSupabaseConfig();
  if (!url || !anon) {
    return { error: { status: 500, message: "Couldn't connect." } };
  }
  const authClient = createAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);
  if (error || !user?.id) {
    return { error: { status: 401, message: "Your session expired." } };
  }
  return { user, supabase: createUserClient(accessToken), accessToken };
}
