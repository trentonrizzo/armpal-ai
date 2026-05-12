// src/lib/sendChatImage.js
//
// Thin wrapper around the EXACT same chat-image send convention used by
// src/pages/ChatPage.jsx (sendImage). We intentionally mirror — never replace —
// that code so existing chats keep working untouched. Bucket name, path style,
// messages-row shape, media-limit RPCs, and recipient-notify behavior are all
// preserved as-is.

import { supabase } from "../supabaseClient";

const BUCKET_IMAGES = "chat-images";

function imagePath(chatId, userId, name) {
  // Matches ChatPage.imagePath exactly so message rows land in the right bucket
  // and can be served back through the same chat UI.
  return `chat-images/${chatId}/${userId}/${Date.now()}-${name}`;
}

async function notifyRecipient(receiverId, title, body, link) {
  if (!receiverId) return;
  try {
    await supabase.from("notifications").insert({
      user_id: receiverId,
      title: title || "New Message",
      body: body || "New message",
      link: link ?? "/messages",
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Upload one image and post it as a 1:1 chat message from `senderId` to
 * `friendId`. Returns { ok, error } so callers can aggregate errors across a
 * batch send.
 *
 * The file is expected to be a Blob / File. A safe default filename is used
 * if the Blob doesn't carry one.
 */
export async function sendImageToFriend({ senderId, friendId, file, fileName }) {
  if (!senderId) return { ok: false, error: "Not signed in." };
  if (!friendId) return { ok: false, error: "No recipient." };
  if (!file) return { ok: false, error: "No file." };

  try {
    const sizeMb = file.size ? file.size / (1024 * 1024) : 0;
    // chat_photo: Supabase chat-images pipeline only (not profile/food-scan "photo").
    // Local Progress Photos vault never hits this RPC — only send-to-friends does.
    const { data: allowed, error: limitErr } = await supabase.rpc(
      "check_media_limits",
      { user_id: senderId, media_type: "chat_photo", file_size_mb: sizeMb }
    );
    if (limitErr || allowed === false) {
      return {
        ok: false,
        error: "Daily upload limit reached. Try again tomorrow.",
      };
    }

    const safeName =
      fileName ||
      file.name ||
      `progress-${Date.now()}.${(file.type || "image/jpeg").split("/")[1] || "jpg"}`;

    const path = imagePath(friendId, senderId, safeName);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_IMAGES)
      .upload(path, file, { upsert: false });
    if (uploadErr) {
      return { ok: false, error: uploadErr.message || "Upload failed." };
    }

    const { data: pubData } = supabase.storage
      .from(BUCKET_IMAGES)
      .getPublicUrl(path);
    if (!pubData?.publicUrl) {
      return { ok: false, error: "Image URL unavailable." };
    }

    const { error: insErr } = await supabase.from("messages").insert({
      sender_id: senderId,
      receiver_id: friendId,
      group_id: null,
      image_url: pubData.publicUrl,
    });
    if (insErr) {
      return { ok: false, error: insErr.message || "Could not send." };
    }

    // Best-effort side-effects (do not fail the send if these error).
    notifyRecipient(friendId, "New Message", "Sent an image", "/messages");
    try {
      await supabase.rpc("increment_media_count", {
        user_id: senderId,
        media_type: "chat_photo",
      });
    } catch {
      /* non-fatal */
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Send failed." };
  }
}
