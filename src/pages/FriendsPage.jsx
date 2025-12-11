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
    // Fetch accepted friends
    const { data: accepted } = await supabase
      .from("friends")
      .select("*, profiles!friends_friend_id_fkey(username, last_active)")
      .eq("user_id", myId)
      .eq("status", "accepted");

    setFriends(accepted || []);

    // incoming requests
    const { data: reqIn } = await supabase
      .from("friends")
      .select("*, profiles!friends_user_id_fkey(username, last_active)")
      .eq("friend_id", myId)
      .eq("status", "pending");

    setIncoming(reqIn || []);

    // outgoing requests
    const { data: reqOut } = await supabase
      .from("friends")
      .select("*, profiles!friends_friend_id_fkey(username, last_active)")
      .eq("user_id", myId)
      .eq("status", "pending");

    setOutgoing(reqOut || []);
  }

  // Accept incoming request
  async function acceptRequest(id) {
    await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", id);

    loadAllFriends(user.id);
  }

  // Decline
  async function declineRequest(id) {
    await supabase.from("friends").delete().eq("id", id);
    loadAllFriends(user.id);
  }

  // Send friend request
  async function sendFriendRequest() {
    setErrorMsg("");

    const username = addInput.trim();
    if (!username) return;

    // Find user by username
    const { data: matched } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (!matched) {
      setErrorMsg("User not found.");
      return;
    }

    if (matched.id === user.id) {
      setErrorMsg("You cannot add yourself.");
      return;
    }

    // Check if already exists
    const { data: exists } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id}, friend_id.eq.${matched.id}),
         and(user_id.eq.${matched.id}, friend_id.eq.${user.id})`
      );

    if (exists && exists.length > 0) {
      setErrorMsg("Friend request already exists or you're already friends.");
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
    return diff < 60000;
  }

  return (
    <div className="p-4 pb-24 text-white">
      <h1 className="text-xl font-bold mb-4">Friends</h1>

      {/* Add Friend */}
      <div className="flex gap-2 mb-4">
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          placeholder="Enter username"
          className="flex-1 bg-white/10 px-3 py-2 rounded-lg outline-none"
        />
        <button
          onClick={sendFriendRequest}
          className="bg-[#ff2f2f] px-3 py-2 rounded-lg font-semibold"
        >
          <FiUserPlus size={18} />
        </button>
      </div>

      {errorMsg && (
        <p className="text-red-500 text-sm mb-2">{errorMsg}</p>
      )}

      {/* Incoming Requests */}
      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Requests</h2>

          <div className="space-y-2">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-white/5 p-3 rounded-lg"
              >
                <span className="font-medium">{req.profiles.username}</span>

                <div className="flex gap-3">
                  <button
                    onClick={() => acceptRequest(req.id)}
                    className="text-green-400 font-semibold"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineRequest(req.id)}
                    className="text-red-400 font-semibold"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <h2 className="text-lg font-semibold mb-2">Your Friends</h2>
      {friends.length === 0 ? (
        <p className="text-white/60 text-sm">No friends yet.</p>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => {
            const profile = f.profiles;
            const online = isOnline(profile.last_active);

            return (
              <div
                key={f.id}
                className="flex items-center justify-between bg-white/5 p-3 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">
                      {profile.username?.charAt(0).toUpperCase()}
                    </div>

                    {online ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-black"></span>
                    ) : null}
                  </div>

                  <div>
                    <p className="font-semibold">{profile.username}</p>
                    <p className="text-xs opacity-60">
                      {online
                        ? "Online"
                        : `Last seen ${new Date(
                            profile.last_active
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/chat/${profile.id}`}
                  className="bg-[#ff2f2f] px-3 py-1 rounded-lg flex items-center gap-1 font-semibold"
                >
                  <FiMessageSquare size={16} />
                  Message
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoing.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Sent Requests</h2>

          <div className="space-y-2">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-white/5 p-3 rounded-lg"
              >
                <span className="font-medium">
                  {req.profiles.username}
                </span>

                <span className="text-yellow-400 text-sm">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
