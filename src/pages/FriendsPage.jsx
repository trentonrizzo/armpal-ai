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

  const [showAddBox, setShowAddBox] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user;
      setUser(current);
      if (current?.id) loadAllFriends(current.id);
    })();
  }, []);

  async function loadAllFriends(uid) {
    const { data: accepted } = await supabase
      .from("friends")
      .select("id, friend_id, status, profiles!friends_friend_id_fkey(id, username, handle, last_active)")
      .eq("user_id", uid)
      .eq("status", "accepted");

    setFriends(accepted || []);

    const { data: inc } = await supabase
      .from("friends")
      .select("id, user_id, status, profiles!friends_user_id_fkey(id, username, handle, last_active)")
      .eq("friend_id", uid)
      .eq("status", "pending");

    setIncoming(inc || []);

    const { data: out } = await supabase
      .from("friends")
      .select("id, friend_id, status, profiles!friends_friend_id_fkey(id, username, handle, last_active)")
      .eq("user_id", uid)
      .eq("status", "pending");

    setOutgoing(out || []);
  }

  async function sendFriendRequest() {
    setErrorMsg("");

    if (!addInput.trim() || !user?.id) return;

    const handle = addInput.trim();

    const { data: target } = await supabase
      .from("profiles")
      .select("id, username, handle")
      .eq("handle", handle)
      .maybeSingle();

    if (!target) {
      setErrorMsg("No user found with that handle.");
      return;
    }

    if (target.id === user.id) {
      setErrorMsg("You can’t add yourself.");
      return;
    }

    const { data: existing } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id}, friend_id.eq.${target.id}),
         and(user_id.eq.${target.id}, friend_id.eq.${user.id})`
      );

    if (existing?.length > 0) {
      setErrorMsg("Request already exists or you're already friends.");
      return;
    }

    await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: target.id,
      status: "pending",
    });

    setAddInput("");
    setShowAddBox(false);
    loadAllFriends(user.id);
  }

  function isOnline(lastActive) {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 60000;
  }

  return (
    <div className="p-4 pb-24 text-white max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Friends</h1>

      {/* ADD FRIEND BUTTON */}
      <button
        onClick={() => setShowAddBox(!showAddBox)}
        className="w-full bg-[#ff2f2f] hover:bg-red-500 active:opacity-80 transition-all py-3 rounded-xl font-semibold text-lg mb-4 flex items-center justify-center gap-2"
      >
        <FiUserPlus size={20} />
        Add Friend
      </button>

      {/* REVEALED ADD BOX */}
      {showAddBox && (
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4">
          <p className="text-sm text-white/70 mb-2">Enter @handle:</p>

          <div className="flex items-center gap-2 mb-2">
            <input
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="@trentarmgod"
              className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 outline-none text-sm"
            />
            <button
              onClick={sendFriendRequest}
              className="bg-[#ff2f2f] rounded-xl px-3 py-2 hover:bg-red-500"
            >
              <FiUserPlus size={18} />
            </button>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}
        </div>
      )}

      {/* FRIEND LIST */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
        
        {/* INCOMING */}
        {incoming.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60 mb-1">
              Friend Requests
            </p>
            {incoming.map((r) => {
              const p = r.profiles;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {p.handle || p.username}
                    </p>
                    <p className="text-[11px] text-white/50">@{p.username}</p>
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <button
                      onClick={async () => {
                        await supabase
                          .from("friends")
                          .update({ status: "accepted" })
                          .eq("id", r.id);
                        loadAllFriends(user.id);
                      }}
                      className="text-green-400"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from("friends").delete().eq("id", r.id);
                        loadAllFriends(user.id);
                      }}
                      className="text-red-400"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FRIENDS LIST */}
        <div>
          <p className="text-sm font-semibold mb-2">Your Friends</p>
          {friends.length === 0 ? (
            <p className="text-xs text-white/60">No friends yet — add some!</p>
          ) : (
            friends.map((f) => {
              const p = f.profiles;
              const online = isOnline(p.last_active);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"
                >
                  <div className="flex gap-3 items-center">
                    {/* avatar placeholder */}
                    <div className="relative">
                      <div className="w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-sm font-bold">
                        {(p.handle || p.username)[0].toUpperCase()}
                      </div>
                      {online && (
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-500 border border-black"></span>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {p.handle || p.username}
                      </p>
                      <p className="text-[11px] text-white/60">
                        {online ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/chat/${p.id}`}
                    className="bg-[#ff2f2f] hover:bg-red-500 px-3 py-1.5 text-xs rounded-lg flex items-center gap-1"
                  >
                    <FiMessageSquare size={14} />
                    Message
                  </Link>
                </div>
              );
            })
          )}
        </div>

        {/* OUTGOING */}
        {outgoing.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">
              Sent Requests
            </p>
            {outgoing.map((r) => {
              const p = r.profiles;
              return (
                <div
                  key={r.id}
                  className="bg-white/5 rounded-xl px-3 py-2 flex justify-between items-center mt-1"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {p.handle || p.username}
                    </p>
                    <p className="text-[11px] text-white/50">@{p.username}</p>
                  </div>
                  <span className="text-yellow-400 text-[11px] font-semibold">
                    Pending
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
