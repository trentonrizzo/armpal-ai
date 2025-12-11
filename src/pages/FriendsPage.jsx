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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        loadAllFriends(data.user.id);
      }
    })();
  }, []);

  async function loadAllFriends(myId) {
    // accepted friends
    const { data: accepted } = await supabase
      .from("friends")
      .select("*, profiles!friends_friend_id_fkey(username, last_active)")
      .eq("user_id", myId)
      .eq("status", "accepted");

    setFriends(accepted || []);

    // incoming pending
    const { data: reqIn } = await supabase
      .from("friends")
      .select("*, profiles!friends_user_id_fkey(username, last_active)")
      .eq("friend_id", myId)
      .eq("status", "pending");

    setIncoming(reqIn || []);

    // outgoing pending
    const { data: reqOut } = await supabase
      .from("friends")
      .select("*, profiles!friends_friend_id_fkey(username, last_active)")
      .eq("user_id", myId)
      .eq("status", "pending");

    setOutgoing(reqOut || []);
  }

  async function acceptRequest(id) {
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    loadAllFriends(user.id);
  }

  async function declineRequest(id) {
    await supabase.from("friends").delete().eq("id", id);
    loadAllFriends(user.id);
  }

  async function sendFriendRequest() {
    setErrorMsg("");
    const search = addInput.trim();
    if (!search) return;

    // RIGHT NOW: search by username only.
    // This is whatever you set as "Username" on your profile.
    const { data: matched, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", search)
      .maybeSingle();

    if (!matched || error) {
      setErrorMsg("User not found.");
      return;
    }

    if (matched.id === user.id) {
      setErrorMsg("You can’t add yourself.");
      return;
    }

    const { data: exists } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id}, friend_id.eq.${matched.id}),
         and(user_id.eq.${matched.id}, friend_id.eq.${user.id})`
      );

    if (exists && exists.length > 0) {
      setErrorMsg("Request already exists or you’re already friends.");
      return;
    }

    await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: matched.id,
      status: "pending",
    });

    setAddInput("");
    loadAllFriends(user.id);
  }

  function isOnline(lastActive) {
    if (!lastActive) return false;
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60_000;
  }

  return (
    <div className="p-4 pb-24 text-white">
      <h1 className="text-2xl font-bold mb-4">Friends</h1>

      {/* ADD FRIEND CARD */}
      <div className="bg-white/5 rounded-2xl p-4 mb-4">
        <p className="text-sm font-semibold mb-3">Add Friend</p>

        <div className="flex gap-2">
          <input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="Search by handle..."
            className="flex-1 bg-black/40 px-3 py-2 rounded-lg text-sm outline-none"
          />
          <button
            onClick={sendFriendRequest}
            className="bg-[#ff2f2f] px-3 py-2 rounded-lg flex items-center justify-center"
          >
            <FiUserPlus size={18} />
          </button>
        </div>

        {errorMsg && (
          <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
        )}
      </div>

      {/* FRIENDS / REQUESTS CARD */}
      <div className="bg-white/5 rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3">Friends</p>

        {/* Incoming requests (inside this card so it still looks clean) */}
        {incoming.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
              Requests
            </p>
            <div className="space-y-2">
              {incoming.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {req.profiles.username}
                  </span>
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
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        {friends.length === 0 ? (
          <p className="text-xs text-white/60">
            No friends yet — add some!
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => {
              const profile = f.profiles;
              const online = isOnline(profile.last_active);

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-sm font-bold">
                        {profile.username?.charAt(0).toUpperCase()}
                      </div>
                      {online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-black"></span>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {profile.username}
                      </p>
                      <p className="text-[11px] text-white/60">
                        {online
                          ? "Online"
                          : profile.last_active
                          ? `Last seen ${new Date(
                              profile.last_active
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Offline"}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/chat/${profile.id}`}
                    className="bg-[#ff2f2f] px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold"
                  >
                    <FiMessageSquare size={14} />
                    <span>Message</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
              Sent Requests
            </p>
            <div className="space-y-2">
              {outgoing.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {req.profiles.username}
                  </span>
                  <span className="text-[11px] text-yellow-400 font-semibold">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
