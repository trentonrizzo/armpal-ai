// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [handleSearch, setHandleSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const navigate = useNavigate();

  // LOAD USER
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadFriends(data.user.id);
    });
  }, []);

  // LOAD FRIENDS + REQUESTS
  async function loadFriends(uid) {
    let { data: f1 } = await supabase
      .from("friends")
      .select("id, friend_id, profiles:friend_id(username, handle)")
      .eq("user_id", uid);

    let { data: f2 } = await supabase
      .from("friends")
      .select("id, user_id, profiles:user_id(username, handle)")
      .eq("friend_id", uid);

    let { data: incomingReq } = await supabase
      .from("friend_requests")
      .select("id, sender_id, profiles:sender_id(username, handle)")
      .eq("receiver_id", uid);

    let { data: outgoingReq } = await supabase
      .from("friend_requests")
      .select("id, receiver_id, profiles:receiver_id(username, handle)")
      .eq("sender_id", uid);

    setFriends([...(f1 || []), ...(f2 || [])]);
    setIncoming(incomingReq || []);
    setOutgoing(outgoingReq || []);
  }

  // SEND REQUEST
  async function sendRequest() {
    if (!handleSearch.trim()) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, handle")
      .eq("handle", handleSearch.trim())
      .single();

    if (!profile) {
      alert("Handle not found!");
      return;
    }

    await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: profile.id,
    });

    setHandleSearch("");
    setShowSearch(false);
    loadFriends(user.id);
  }

  // ACCEPT
  async function acceptRequest(id) {
    const request = incoming.find((r) => r.id === id);
    if (!request) return;

    await supabase.from("friends").insert([
      { user_id: user.id, friend_id: request.sender_id },
      { user_id: request.sender_id, friend_id: user.id },
    ]);

    await supabase.from("friend_requests").delete().eq("id", id);
    loadFriends(user.id);
  }

  // DECLINE / CANCEL
  async function removeRequest(id) {
    await supabase.from("friend_requests").delete().eq("id", id);
    loadFriends(user.id);
  }

  return (
    <div className="p-4 text-white">
      <h1 className="text-3xl font-bold mb-4">Friends</h1>

      {/* ADD FRIEND BUTTON */}
      {!showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl text-lg mb-4 shadow-lg active:scale-95 transition"
        >
          ➕ Add Friend
        </button>
      )}

      {/* HANDLE INPUT */}
      {showSearch && (
        <div className="mb-6 bg-[#111] p-4 rounded-xl border border-red-600">
          <input
            className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white"
            placeholder="@handle..."
            value={handleSearch}
            onChange={(e) => setHandleSearch(e.target.value)}
          />

          <button
            onClick={sendRequest}
            className="w-full mt-3 bg-red-600 py-2 rounded-lg font-semibold active:scale-95 transition"
          >
            Send Request
          </button>

          <button
            onClick={() => setShowSearch(false)}
            className="w-full mt-2 py-2 text-gray-400 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* INCOMING REQUESTS */}
      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Incoming Requests</h2>

          {incoming.map((req) => (
            <div
              key={req.id}
              className="bg-[#111] border border-gray-700 p-4 rounded-xl mb-2"
            >
              <p className="text-lg font-semibold">@{req.profiles.handle}</p>

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="flex-1 bg-green-600 py-2 rounded-lg"
                >
                  Accept
                </button>
                <button
                  onClick={() => removeRequest(req.id)}
                  className="flex-1 bg-red-600 py-2 rounded-lg"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OUTGOING REQUESTS */}
      {outgoing.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Pending Requests</h2>

          {outgoing.map((req) => (
            <div
              key={req.id}
              className="bg-[#111] border border-gray-700 p-4 rounded-xl mb-2"
            >
              <p className="text-lg font-semibold">@{req.profiles.handle}</p>

              <button
                onClick={() => removeRequest(req.id)}
                className="mt-2 w-full bg-red-600 py-2 rounded-lg"
              >
                Cancel Request
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FRIENDS LIST */}
      <h2 className="text-xl font-bold mb-2">Your Friends</h2>

      {friends.length === 0 ? (
        <p className="text-gray-400">No friends yet — add some!</p>
      ) : (
        friends.map((friend) => (
          <div
            key={friend.id}
            onClick={() => navigate(`/chat/${friend.friend_id || friend.user_id}`)}
            className="bg-[#111] border border-gray-700 p-4 rounded-xl mb-3 active:scale-[0.98] transition cursor-pointer"
          >
            <p className="text-lg font-semibold">
              @{friend.profiles.handle}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
