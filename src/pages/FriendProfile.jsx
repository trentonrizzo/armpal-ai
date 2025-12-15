import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function formatLastActive(lastActive) {
  if (!lastActive) return "Offline";

  const now = Date.now();
  const diff = now - new Date(lastActive).getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const year = 365 * day;

  if (diff < 2 * minute) return "Online";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < week) return `${Math.floor(diff / day)}d`;
  if (diff < year) return `${Math.floor(diff / week)}w`;

  return `${Math.floor(diff / year)}y`;
}

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFriend() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url, last_active")
        .eq("id", friendId)
        .single();

      if (!error) setFriend(data);
      setLoading(false);
    }

    loadFriend();
  }, [friendId]);

  async function handleUnfriend() {
    const confirm = window.confirm(
      "Are you sure you want to remove this friend? This cannot be undone."
    );
    if (!confirm) return;

    await supabase.from("friends").delete().or(
      `user_id.eq.${friendId},friend_id.eq.${friendId}`
    );

    navigate("/friends");
  }

  if (loading) return null;
  if (!friend) return <div className="p-4 text-white">User not found</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex flex-col items-center text-center">
        <img
          src={friend.avatar_url || "/avatar-placeholder.png"}
          alt="avatar"
          className="w-28 h-28 rounded-full object-cover mb-4"
        />

        <h1 className="text-xl font-bold">{friend.display_name}</h1>
        <p className="text-gray-400">@{friend.handle}</p>

        <p className="text-sm text-gray-400 mt-2">
          {formatLastActive(friend.last_active)}
        </p>

        {friend.bio && (
          <p className="mt-4 text-gray-300 max-w-md">{friend.bio}</p>
        )}

        <button
          onClick={() => navigate(`/chat/${friend.id}`)}
          className="mt-6 w-full max-w-xs py-3 rounded-xl bg-red-600 hover:bg-red-700 transition"
        >
          Message
        </button>

        <button
          onClick={handleUnfriend}
          className="mt-4 text-sm text-red-400 hover:text-red-500"
        >
          Unfriend
        </button>
      </div>
    </div>
  );
}
