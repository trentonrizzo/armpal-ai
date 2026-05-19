import { supabase } from "../supabaseClient";

/** Max wait for initial session read before rendering the app anyway. */
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

/** Hard ceiling — always dismiss splash / allow render. */
export const AUTH_BOOTSTRAP_FORCE_READY_MS = 10000;

/**
 * Resolve the initial Supabase session without blocking app render forever.
 * @returns {Promise<{ session: import('@supabase/supabase-js').Session | null, timedOut: boolean, error: Error | null }>}
 */
export async function bootstrapAuthSession() {
  const timeoutError = new Error("auth_bootstrap_timeout");

  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data, error }) => ({
        session: data?.session ?? null,
        timedOut: false,
        error: error ? new Error(error.message) : null,
      })),
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              session: null,
              timedOut: true,
              error: timeoutError,
            }),
          AUTH_BOOTSTRAP_TIMEOUT_MS
        );
      }),
    ]);
    return result;
  } catch (err) {
    return {
      session: null,
      timedOut: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
