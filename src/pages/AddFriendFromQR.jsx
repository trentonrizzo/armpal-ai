
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function AddFriendFromQR() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const targetId = params.get("uid");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [target, setTarget] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user;

      if (!me || !targetId) {
        navigate("/friends");
        return;
      }

      if (me.id === targetId) {
        setStatus("This is you.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username, handle")
        .eq("id", targetId)
        .maybeSingle();

      if (!profile) {
        setStatus("User not found.");
        setLoading(false);
        return;
      }

      setTarget(profile);

      const { data: existing } = await supabase
        .from("friends")
        .select("id, status")
        .or(
          `and(user_id.eq.${me.id},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${me.id})`
        );

      if (existing && existing.length > 0) {
        setStatus(
          existing[0].status === "accepted"
            ? "You are already friends."
            : "Friend request already pending."
        );
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
    })();
  }, [targetId, navigate]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Add Friend</h1>
      {loading ? <p>Processing…</p> : <p>{status}</p>}
      <button onClick={() => navigate("/friends")}>Back to Friends</button>
    </div>
  );
}
