/**
 * Centralized AI conversation handling.
 * No Pro checks here — caller (DashboardAIChat) uses usageLimits.js for gating.
 */

import { supabase } from "../supabaseClient";

const MAX_CONVERSATIONS = 10;

export async function listConversations(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_CONVERSATIONS);
  if (error) {
    console.error("listConversations:", error);
    return [];
  }
  return data || [];
}

export async function createConversation(userId, title = null) {
  if (!userId) return null;
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId);
  if (existing && existing.length >= MAX_CONVERSATIONS) return null;
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: title || "New chat" })
    .select()
    .single();
  if (error) {
    console.error("createConversation:", error);
    return null;
  }
  return data;
}

export async function updateConversationTitle(conversationId, title) {
  if (!conversationId) return null;
  const { data, error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select()
    .single();
  if (error) {
    console.error("updateConversationTitle:", error);
    return null;
  }
  return data;
}

export async function deleteConversation(conversationId) {
  if (!conversationId) return false;
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);
  if (error) {
    console.error("deleteConversation:", error);
    return false;
  }
  return true;
}

/** Bump updated_at so conversation sorts to top */
export async function touchConversation(conversationId) {
  if (!conversationId) return;
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function getMessages(conversationId) {
  if (!conversationId) return [];
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getMessages:", error);
    return [];
  }
  return data || [];
}

/** First ~5 words of text for auto-title */
export function titleFromFirstMessage(text) {
  if (!text || typeof text !== "string") return "New chat";
  const trimmed = text.trim().replace(/\s+/g, " ");
  const words = trimmed.split(" ").slice(0, 5);
  return words.length ? words.join(" ") : "New chat";
}
