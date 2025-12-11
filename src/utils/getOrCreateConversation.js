// src/utils/getOrCreateConversation.js
import { supabase } from "../supabaseClient";

/**
 * Gets an existing conversation between two users
 * OR creates one if none exists.
 *
 * Returns: conversation.id
 */
export async function getOrCreateConversation(userId, friendId) {
  if (!userId || !friendId) return null;

  // 1️⃣ Check for existing convo
  const { data: existing, error: checkErr } = await supabase
    .from("conversations")
    .select("*")
    .or(
      `and(user1_id.eq.${userId}, user2_id.eq.${friendId}),
       and(user1_id.eq.${friendId}, user2_id.eq.${userId})`
    )
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id; // return existing conversation
  }

  // 2️⃣ Create a new conversation
  const { data: newConvo, error: createErr } = await supabase
    .from("conversations")
    .insert({
      user1_id: userId,
      user2_id: friendId,
    })
    .select()
    .single();

  if (createErr) {
    console.error("Error creating conversation:", createErr);
    return null;
  }

  return newConvo.id;
}
