import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// =================================================================================================
// ARM PAL — ADD FRIEND FROM QR (UID OR HANDLE)
// - Supports /add-friend?uid=...  OR  /add-friend?handle=...
// - Sends pending friend request (if not existing)
// - Shows quick status + back button
// =================================================================================================

export default function AddFriendFromQR() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const uidParam = params.get("uid");
  const handleParamRaw = params.get("handle");
  const handleParam = handleParamRaw ? handleParamRaw.replace(/^@/, "") : null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Processing…");

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth?.user;

        if (!me) {
          setStatus("Please sign in first.");
          setLoading(false);
          return;
        }

        let targetId = uidParam || null;

        if (!targetId && handleParam) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .ilike("handle", handleParam)
            .maybeSingle();

          targetId = prof?.id || null;
        }

        if (!targetId) {
          setStatus("User not found.");
          setLoading(false);
          return;
        }

        if (targetId === me.id) {
          setStatus("That’s your own QR code.");
          setLoading(false);
          return;
        }

        const { data: existing } = await supabase
          .from("friends")
          .select("id, status")
          .or(
            `and(user_id.eq.${me.id},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${me.id})`
          );

        if (existing?.length > 0) {
          const st = String(existing[0].status || "").toLowerCase();
          setStatus(st === "accepted" ? "You are already friends." : "Friend request already pending.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.from("friends").insert({
          user_id: me.id,
          friend_id: targetId,
          status: "pending",
        });

        if (error) {
          setStatus("Could not send request.");
        } else {
          setStatus("Friend request sent.");
        }

        setLoading(false);
      } catch (e) {
        setStatus("Something went wrong.");
        setLoading(false);
      }
    })();
  }, [uidParam, handleParam]);

  return (
    <div style={{ padding: 18, color: "var(--text)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Add Friend</h1>
      <p style={{ opacity: 0.85, marginBottom: 14 }}>{loading ? "Processing…" : status}</p>
      <button
        onClick={() => navigate("/friends", { state: { refresh: Date.now() } })}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--text)",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Back to Friends
      </button>
    </div>
  );
}
