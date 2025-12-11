// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { FiUserPlus, FiMessageSquare } from "react-icons/fi";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  const [addInput, setAddInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
      }
      setLoading(false);
    })();
  }, []);

  async function loadAllFriends(myId) {
    // accepted friends
    const { data: accepted } = await supabase
      .from("friends")
      .select(
        "id, friend_id, status, profiles:friends_friend_id_fkey (id, username, handle, last_active)"
      )
      .eq("user_id", myId)
      .eq("status", "accepted");

    setFriends(accepted || []);

    // incoming pending: they added YOU
    const { data: reqIn } = await supabase
      .from("friends")
      .select(
        "id, user_id, status, profiles:friends_user_id_fkey (id, username, handle, last_active)"
      )
      .eq("friend_id", myId)
      .eq("status", "pending");

    setIncoming(reqIn || []);

    // outgoing pending: YOU added THEM
    const { data: reqOut } = await supabase
      .from("friends")
      .select(
        "id, friend_id, status, profiles:friends_friend_id_fkey (id, username, handle, last_active)"
      )
      .eq("user_id", myId)
      .eq("status", "pending");

    setOutgoing(reqOut || []);
  }

  function isOnline(lastActive) {
    if (!lastActive) return false;
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60_000; // last 60s = online
  }

  async function acceptRequest(id) {
    if (!user?.id) return;
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    await loadAllFriends(user.id);
  }

  async function declineRequest(id) {
    if (!user?.id) return;
    await supabase.from("friends").delete().eq("id", id);
    await loadAllFriends(user.id);
  }

  async function sendFriendRequest() {
    setErrorMsg("");

    if (!user?.id) return;
    const handle = addInput.trim();
    if (!handle) return;

    // find by handle (the @ thing)
    const { data: target, error } = await supabase
      .from("profiles")
      .select("id, username, handle")
      .eq("handle", handle)
      .maybeSingle();

    if (error || !target) {
      setErrorMsg("No user found with that handle.");
      return;
    }

    if (target.id === user.id) {
      setErrorMsg("You can’t add yourself.");
      return;
    }

    // already friends or pending?
    const { data: existing } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id}, friend_id.eq.${target.id}),
         and(user_id.eq.${target.id}, friend_id.eq.${user.id})`
      );

    if (existing && existing.length > 0) {
      setErrorMsg("Request already exists or you’re already friends.");
      return;
    }

    await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: target.id,
      status: "pending",
    });

    setAddInput("");
    await loadAllFriends(user.id);
  }

  return (
    <div className="p-4 pb-24 text-white max-w-xl mx-auto">
      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-4">Friends</h1>

      {/* ADD FRIEND CARD */}
      <section className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-4">
        <p className="text-sm font-semibold mb-2">Add Friend</p>
        <p className="text-xs text-white/60 mb-3">
          Search by <span className="font-mono">@handle</span> your friend sets
          on their profile.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="@trentarmgod"
            className="flex-1 bg-black/50 rounded-xl border border-white/15 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={sendFriendRequest}
            className="bg-[#ff2f2f] hover:bg-red-500 transition px-3 py-2 rounded-xl flex items-center justify-center"
          >
            <FiUserPlus size={18} />
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
        )}
      </section>

      {/* MAIN FRIENDS CARD */}
      <section className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-4">
        {/* INCOMING REQUESTS */}
        {incoming.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
              Requests
            </p>
            <div className="space-y-2">
              {incoming.map((req) => {
                const p = req.profiles;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {p.handle || p.username}
                      </p>
                      <p className="text-[11px] text-white/60">
                        @{p.username}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs font-semibold">
                      <button
                        onClick={() => acceptRequest(req.id)}
                        className="text-green-400"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRequest(req.id)}
                        className="text-red-400"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FRIENDS LIST */}
        <div>
          <p className="text-sm font-semibold mb-2">Friends</p>
          {loading ? (
            <p className="text-xs text-white/60">Loading...</p>
          ) : friends.length === 0 ? (
            <p className="text-xs text-white/60">
              No friends yet — add some!
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const p = f.profiles;
                const online = isOnline(p.last_active);

                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-sm font-bold">
                          {(p.handle || p.username || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-black" />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          {p.handle || p.username}
                        </p>
                        <p className="text-[11px] text-white/60">
                          {online
                            ? "Online"
                            : p.last_active
                            ? `Last seen ${new Date(
                                p.last_active
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Offline"}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/chat/${p.id}`}
                      className="bg-[#ff2f2f] hover:bg-red-500 transition px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold"
                    >
                      <FiMessageSquare size={14} />
                      <span>Message</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* OUTGOING REQUESTS */}
        {outgoing.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
              Sent Requests
            </p>
            <div className="space-y-2">
              {outgoing.map((req) => {
                const p = req.profiles;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {p.handle || p.username}
                      </p>
                      <p className="text-[11px] text-white/60">
                        @{p.username}
                      </p>
                    </div>
                    <span className="text-[11px] text-yellow-400 font-semibold">
                      Pending
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
