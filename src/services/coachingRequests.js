import { supabase } from "../supabaseClient";

/**
 * Insert a 1-on-1 coaching request for the authenticated user.
 * Requires public.coaching_requests (user_id, name, instagram, goal, experience, notes).
 */
export async function submitCoachingRequest({
  userId,
  name,
  instagram,
  goal,
  experience,
  notes,
}) {
  if (!userId) {
    throw new Error("You must be signed in to request coaching.");
  }

  const payload = {
    user_id: userId,
    name: name.trim(),
    instagram: instagram.trim().replace(/^@+/, ""),
    goal: goal.trim(),
    experience,
    notes: notes?.trim() ? notes.trim() : null,
  };

  const { error } = await supabase.from("coaching_requests").insert(payload);
  if (error) throw error;
}
